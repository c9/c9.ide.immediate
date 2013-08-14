define(function(require, exports, module) {
    main.consumes = ["plugin", "immediate", "settings"];
    main.provides = ["evaluator-js-browser"];
    return main;
    
    /*
        Auto-complete
        i had a simple parser to get expression backwards
        https://github.com/MikeRatcliffe/Acebug/blob/master/chrome/content/autocompleter.js#L350-L592
        and a simple fuzzysearch https://github.com/MikeRatcliffe/Acebug/blob/master/chrome/content/autocompleter.js#L278-L332
        evaluate expression before and 
        Object.getOwnPropertyNames on the result
    */
    
    /*
        Test Cases:
        1
        "1"
        new Error()
        window
        console.log("1");
        throw new Error("1");
        
        Missing:
        get/set in object
        __proto__
    */

    function main(options, imports, register) {
        var Plugin    = imports.plugin;
        // var settings  = imports.settings;
        var immediate = imports.immediate;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit   = plugin.getEmitter();
        
        var iframe, win;
        
        var loaded;
        function load(){
            if (loaded) return;
            loaded = true;
            
            immediate.addType("Javascript (browser)", "jsbrowser", evaluator, plugin);
    
            iframe = document.body.appendChild(document.createElement("iframe"));
            iframe.style.width    = "1px";
            iframe.style.height   = "1px";
            iframe.style.position = "absolute";
            iframe.style.left     = "-100px";
            iframe.style.top      = "-100px";
            
            win = iframe.contentWindow;
        }
        
        /***** Evaluator *****/
        
        var counter = 0;
        function Console(cell){
            this.name = "output_section" + (++counter);
            this.cell = cell;
            
            this.html = document.createElement("div");
            this.cell.addWidget({ el: this.html, coverLine: true });
        }
        Console.prototype = {
            write : function () {
                var html = this.html.appendChild(document.createElement("div"));
                var type = arguments[arguments.length - 1];
                html.className = type;
                
                for (var i = 0; i < arguments.length - 1; i++) {
                    renderType(arguments[i], html, type != "return");
                }
                insert(html, "<br />");
                
                html.updateWidget = this.$update.bind(this);
                html.updateWidget();
            },
            log : function(output){ 
                var args = Array.prototype.slice.apply(arguments);
                args.push("log");
                return this.write.apply(this, args); 
            },
            error : function(output){ 
                var args = Array.prototype.slice.apply(arguments);
                args.push("error");
                return this.write.apply(this, args); 
            },
            warn : function(output){ 
                var args = Array.prototype.slice.apply(arguments);
                args.push("warning");
                return this.write.apply(this, args); 
            },
            $update : function() {
                this.cell.session.repl.onWidgetChanged(this.cell);                
            }
        };
        
        function insert(div, markup, name){
            if (name !== undefined) 
                insert(div, "<span class='property'>" + name + ": </span>");
            
            markup = markup.replace(/([a-z]\w{1,4}:\/\/[\w:_\-\?&\/\.\#]*)/gi, "<a>$1</a>");
            div.insertAdjacentHTML("beforeend", markup);
            
            if (div.lastChild.nodeType == 1) {
                var nodes = div.lastChild.querySelectorAll("a");
                for (var i = 0; i < nodes.length; i++) {
                    nodes[i].addEventListener("click", function(e){
                        alert(this.firstChild.nodeValue);
                        e.stopPropagation();
                    });
                }
            }
        }
        
        function insertTree(div, caption, object, drawChildren){
            // caption can be a string or an html element
            var treeitem = div.appendChild(document.createElement("span"));
            var arrow    = treeitem.appendChild(document.createElement("span"))
            treeitem.className = "treeitem";
            arrow.className    = "arrow";
            treeitem.appendChild(caption);
            
            var container;
            treeitem.addEventListener("click", function(e){
                e.stopPropagation();
                
                if (!container) {
                    container = treeitem.appendChild(document.createElement("div"));
                    container.className = "treecontainer";
                    container.style.display = "none";
                    drawChildren(object, container);
                }
                
                var collapsed = container.style.display == "none";
                arrow.className = "arrow " + (collapsed ? "expanded" : "");
                container.style.display = collapsed ? "block" : "none";
                
                // hack!
                var target = e.currentTarget;
                while(target) {
                    if (target.updateWidget) {
                        target.updateWidget();
                        break;
                    }
                    target = target.parentNode;
                }
            })
        }
        
        function parseChildren(object, html){
            if (object instanceof win.Array) {
                if (object.length < 101) {
                    object.forEach(function(item, i){
                        renderType(item, html, 2, false, i);
                        insert(html, "<br />");
                    });
                }
                else {
                    
                }
            }
            else if (object.$arrayWalker) {
                
            }
            else if (object instanceof win.Error) {
                var stack = object.stack.split("\n");
                stack.shift();
                stack = stack.join("<br />");
                insert(html, "<div class='stack'>" + stack + "</div>");
            }
            
            var keys = Object.getOwnPropertyNames(object);
            keys.forEach(function(name){
                renderType(object[name], html, 2, false, name);
                insert(html, "<br />");
            });
        }
        
        function renderType(object, html, log, short, name){
            var type = typeof object;
            var caption;
            
            if (object === undefined || object == null) {
                insert(html, "<span class='null'>" + type + "</span>", name);
            }
            else if (type == "string") {
                if (!log || log == 2) {
                    var str = "\"<span class='string'>" + JSON.stringify(object).slice(1, -1) + "</span>\"";
                    if (name && object.length > 100) {
                        var event = "this.style.display = \"none\";\
                            this.nextSibling.style.display = \"inline\";\
                            event.stopPropagation()";
                        str = "<span class='stringcollapse'><span onclick='" + event 
                            + "'>(...)</span><span>" + str
                            + "</span></span>"
                    }
                    insert(html, str, name);
                }
                else {
                    insert(html, object, name);
                }
            }
            else if (type == "number") {
                insert(html, "<span class='number'>" + object + "</span>", name);
            }
            else if (type == "function") {
                insert(html, "<span class='function'>" 
                    + (short ? "function" : object.toString()) + "</span>", name);
            }
            else if (type == "boolean") {
                insert(html, "<span class='boolean'>" + object + "</span>", name);
            }
            else if (!log && object instanceof win.RegExp) {
                insert(html, "<span class='regexp'>" 
                    + object.toString() + "</span>", name);
            }
            else if (object instanceof win.Array) {
                if (short) {
                    insert(html, "Array [" + object.length + "]", name);
                    return;
                }
                else {
                    // Detect Sparse Array via every
                    if (false) {
                        
                    }
                    
                    if (log) {
                        caption = document.createElement("span");
                        insert(caption, "", name);
                        var preview = caption.appendChild(document.createElement("span"));
                        preview.className = "preview";
                        
                        insert(preview, "[", name);
                        object.every(function(item, i){
                            renderType(item, preview, false, true);
                            if (i < object.length - 2)
                                insert(preview, ", ");
                            
                            return i < 100;
                        });
                        
                        var props = Object.getOwnPropertyNames(object);
                        var count = Math.min(Math.min(props.length, 5), 
                            Math.max(0, 100 - object.length));
                        for (var i = 0; i < count; i++) {
                            insert(preview, (i !== 0 ? ", " : "") + props[i] + ": ");
                            renderType(object[props[i]], preview, false, 2);
                        }
                        if (props.length > count)
                            insert(preview, "…");
                            
                        insert(preview, "]");
                    }
                    else if (object.length > 100) {
                        caption = document.createElement("span");
                        insert(caption, "Array [" + object.length + "]", name);
                    }
                    else {
                        insert(html, "[", name);
                        object.forEach(function(item, i){
                            renderType(item, html, false, 2);
                            if (i < object.length - 1)
                                insert(html, ", ");
                        });
                        insert(html, "]");
                        return;
                    }
                }
                
                insertTree(html, caption, object, parseChildren);
            }
            // HTML Element
            else if (object instanceof win.HTMLDocument 
              || object instanceof win.HTMLElement) {
                
            }
            // XML Element
            else if (object instanceof win.XMLDocument 
              || object instanceof win.Element) {
                
            }
            // Object
            else {
                var type;
                if (object["$$error"]) {
                    object = object["$$error"];
                    type   = object.stack.split(":")[0];
                    type = "<span class='err'>"
                        + type + ": "
                        + (object.message || (!object ? object : object.toString()))
                        + "</span>";
                    
                    caption = document.createElement("span");
                    insert(caption, type, name);
                }
                else {
                    type = (object.constructor.toString().match(/^function\s+(\w+)/) 
                        || [0,"(anonymous function)"])[1]
                    if (short) 
                        return insert(html, type, name);
                
                    caption = document.createElement("span");
                    insert(caption, type, name);
                    var preview = caption.appendChild(document.createElement("span"));
                    preview.className = "preview";
                    
                    insert(preview, " {");
                    
                    // @TODO https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptor
                    
                    var props = Object.getOwnPropertyNames(object);
                    var count = Math.min(props.length, 5);
                    for (var i = 0; i < count; i++) {
                        insert(preview, (i !== 0 ? ", " : ""));
                        insert(preview, "", props[i]);
                        renderType(object[props[i]], preview, false, 2);
                    }
                    if (props.length > count)
                        insert(preview, "…");
                    
                    insert(preview, "}");
                }
                
                insertTree(html, caption, object, parseChildren);
            }
        }
        
        var evaluator = {
            name        : "Test",
            mode        : "ace/mode/javascript",
            message     : "",
            canEvaluate : function(str) { return true; },
            evaluate    :  function(expression, cell, cb) {
                // Ignore heroku command if typed
                // str = str.replace(/^heroku\s+/, "");
                
                // cell.addWidget({rowCount: 6, html:"<img src='http://martin.bravenboer.name/logo-trans-85.png'>"})
                // cell.addWidget({rowCount: 8, el:editor.container, editor: editor})
                
                // var session = cell.session;
                // var args    = str.trim().split(" ");
                // if (evaluator.name && str.indexOf("-a") == -1)
                //     args.push("-a", evaluator.name);
                
                // cb("Authorization Required");
                // cell.insert(data);
                
                // //cell.addWidget({rowCount: 6, html:"<span class='error'>" + data + "</span>"});
                // cell.insert(pos, "Error: " + data);
                
                // cb(buffer);
                 
                var output = new Console(cell);
                 
                win.console = output;
                
                try {
                    win.thrown = false;
                    win.eval("try{window.result = " + expression 
                        + "}catch(e){window.thrown = true; window.result = e}");
                } catch(e) {
                    try {
                        win.thrown = false;
                        win.eval("try{" + expression 
                            + "}catch(e){window.thrown = true; window.result = e}");
                    } catch(e) {
                        win.result = e;
                        win.thrown = 2;
                    }
                }
                var result = win.result;
                if (win.thrown)
                    result = { "$$error" : result, type: win.thrown }; 
    
                output.write(result, "return");
                 
                cell.setWaiting(false);
                //cb("Done");
            }
        };
        
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });
        plugin.on("enable", function(){
            
        });
        plugin.on("disable", function(){
            
        });
        plugin.on("unload", function(){
            loaded = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * 
         **/
        plugin.freezePublicAPI({ });
        
        register(null, {
            "evaluator-js-browser": plugin
        });
    }
});