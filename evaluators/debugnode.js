define(function(require, exports, module) {
    main.consumes = [
        "immediate", "settings", "debugger", "Evaluator", "callstack"
    ];
    main.provides = ["immediate.debugnode"];
    return main;

    function main(options, imports, register) {
        var Evaluator = imports.Evaluator;
        var settings  = imports.settings;
        var debug     = imports.debugger;
        var immediate = imports.immediate;
        var callstack = imports.callstack;
        
        /***** Initialization *****/
        
        var plugin = new Evaluator("Ajax.org", main.consumes, {
            caption : "Debugger",
            id      : "debugger",
            mode    : "ace/mode/javascript", // @todo make this variable: repl.session.setMode
            message : ""
        });
        // var emit   = plugin.getEmitter();
        
        var dbg, log, lastCell;
        
        var loaded;
        function load(){
            if (loaded) return;
            loaded = true;
            
            // Set and clear the dbg variable
            debug.on("attach", function(e){
                dbg = e.implementation;
                if (dbg.attachLog)
                    initLog(dbg.attachLog());
            });
            debug.on("detach", function(e){
                dbg = null;
            });
            debug.on("stateChange", function(e){
                plugin[e.action]();
            });
        }
        
        /***** Log *****/
        
        function writeLog() {
            var cell;
            var dist = 1;
            var type = arguments[arguments.length - dist];
            if (type && type.addWidget) {
                dist++;
                cell = type;
                type = arguments[arguments.length - dist];
            }
            if (!cell)
                cell = lastCell;
            if (!cell.html)
                createWidget(cell);
            
            var html = cell.html.appendChild(document.createElement("div"));
            html.className = type;
            
            for (var i = 0; i < arguments.length - dist; i++) {
                renderType(arguments[i], html, type != "return");
            }
            insert(html, "<br />");
            
            html.updateWidget = updateWidget.bind(cell);
            html.updateWidget();
            scrollIntoView(cell);
        }
        
        function updateWidget() {
            this.session.repl.onWidgetChanged(this);
        }
        
        function scrollIntoView(cell) {
            if (!cell.session.repl.editor)
                return;

            // TODO add a better way to scroll ace cursor into view when rendered
            var renderer = cell.session.repl.editor.renderer;
            setTimeout(function() {
                renderer.scrollCursorIntoView();
            });
        }
        
        function initLog(proxy){
            log = proxy;
            log.on("log", function(e){
                var args = Array.prototype.slice.apply(arguments);
                args.push(e.type);
                writeLog.apply(log, args); 
            }, plugin);
        }
        
        function createWidget(cell){
            cell.html = document.createElement("div");
            cell.addWidget({ el: cell.html, coverLine: true, fixedWidth: true });
        }
        
        /***** Analyzer *****/
        
        function insert(div, markup, name){
            if (name !== undefined) 
                insert(div, "<span class='property'>" + name + ": </span>");
            
            markup = markup.replace(/([a-z]\w{1,4}:\/\/[\w:_\-\?&\/\.\#]*)/gi, "<a>$1</a>");
            div.insertAdjacentHTML("beforeend", markup);
            
            if (div.lastChild && div.lastChild.nodeType == 1) {
                var nodes = div.lastChild.querySelectorAll("a");
                for (var i = 0; i < nodes.length; i++) {
                    nodes[i].addEventListener("click", function(e){
                        //@todo
                        alert(this.firstChild.nodeValue);
                        e.stopPropagation();
                    });
                }
            }
        }
        
        function insertTree(div, caption, object, drawChildren){
            // caption can be a string or an html element
            var treeitem = div.appendChild(document.createElement("span"));
            var arrow    = treeitem.appendChild(document.createElement("span"));
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
                    drawChildren(object, container, function(){
                        findWidgetAndUpdate(target);
                    });
                }
                
                var collapsed = container.style.display == "none";
                arrow.className = "arrow " + (collapsed ? "expanded" : "");
                container.style.display = collapsed ? "block" : "none";
                
                // hack!
                var target = e.currentTarget;
                findWidgetAndUpdate(target)
            })
        }
        
        function findWidgetAndUpdate(target){
            while(target) {
                if (target.updateWidget) {
                    target.updateWidget();
                    break;
                }
                target = target.parentNode;
            }
        }
        
        function parseChildren(object, html, callback){
            if (object.value == "[Array]") {
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
            else if (object instanceof Error) {
                var stack = (object.stack || "").split("\n");
                stack.shift();
                stack = stack.join("<br />");
                insert(html, "<div class='stack'>" + stack + "</div>");
            }
            // else if (object instanceof win.Element) {
            //     if (!html.parentNode.innerText.match(/HTML\w*Element/)) {
            //         var children = object.childNodes;
            //         for (var i = 0; i < children.length; i++) {
            //             renderType(children[i], html, false, 2);
            //             insert(html, "<br />");
            //         }
            //         insert(html, "&lt;/" + object.tagName.toLowerCase() + "&gt;");
            //         return;
            //     }
            // }
            
            if (!object.properties) {
                dbg.getProperties(object, function(err, properties){
                    // if (properties && properties.length)
                    parseChildren(object, html, callback)
                });
                return;
            }
            
            (object.properties || []).forEach(function(prop){
                renderType(prop, html, 2, 2, prop.name);
                insert(html, "<br />");
            });
            
            callback();
        }
        
        function getOwnProperties(object){
            var result = [];
            (object.properties || []).forEach(function(o){
                if (typeof o.name != "number")
                    result.push(o)
            })
        }
        
        function renderType(object, html, log, short, name){
            var type  = object.type;
            var value = object.value;
            var caption;
            
            if (object.name && typeof object.name == "string" 
              && object.name.indexOf("function") === 0)
                type = "function";
            
            if (type == "undefined" || type == "null") {
                insert(html, "<span class='null'>" + type + "</span>", name);
            }
            else if (type == "string") {
                if (!log || log == 2) {
                    value = value.slice(1, -1)
                        .replace(/</g, "&lt;");
                    var str   = "\"<span class='string'>" + value + "</span>\"";
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
                insert(html, "<span class='number'>" + value + "</span>", name);
            }
            else if (type == "function") {
                insert(html, "<span class='function'>" 
                    + object.name
                        .replace(/ /g, "&nbsp;") 
                        .replace(/\n/g, "<br />") 
                    + "</span>", name);
            }
            else if (type == "boolean") {
                insert(html, "<span class='boolean'>" + value + "</span>", name);
            }
            else if (!log && type == "regexp") {
                insert(html, "<span class='regexp'>" 
                    + object.name + "</span>", name);
            }
            else if (value == "[Array]") {
                if (short) {
                    insert(html, "Array [" + object.name + "]", name);
                    return;
                }
                else {
                    // Detect Sparse Array via every
                    if (false) {
                        
                    }
                    
                    var j = 0;
                    if (log) {
                        caption = document.createElement("span");
                        insert(caption, "", name);
                        var preview = caption.appendChild(document.createElement("span"));
                        preview.className = "preview";
                        
                        insert(preview, "[", name);
                        
                        (object.properties || []).every(function(item, i){
                            if (typeof item.name != "number") {
                                j++;
                                return true;
                            }
                            
                            renderType(item, preview, false, true);
                            if (i < object.properties.length - 2 - j)
                                insert(preview, ", ");
                            
                            return (i - j) < 100;
                        });
                        
                        var props = getOwnProperties(object);
                        var count = Math.min(Math.min(props.length, 5), 
                            Math.max(0, 100 - object.length));
                        for (var i = 0; i < count; i++) {
                            insert(preview, (i !== 0 ? ", " : "") + props[i] + ": ");
                            renderType(props[i], preview, false, 2);
                        }
                        if (props.length > count)
                            insert(preview, "…");
                            
                        insert(preview, "]");
                    }
                    else if ((object.properties || "").length > 100) {
                        caption = document.createElement("span");
                        insert(caption, "Array [" + object.properties.length + "]", name);
                    }
                    else {
                        insert(html, "[", name);
                        (object.properties || []).every(function(item, i){
                            if (typeof item.name != "number") {
                                j++;
                                return true;
                            }
                            
                            renderType(item, html, false, 2);
                            if (i < object.properties.length - 1)
                                insert(html, ", ");
                            
                            return true;
                        });
                        insert(html, "]");
                        return;
                    }
                }
                
                insertTree(html, caption, object, parseChildren);
            }
            // // HTML/XML Element
            // else if (object instanceof win.Node && log === false) {
            //     // Text Node
            //     if (object.nodeType == 3) {
            //         insert(html, "<span class='textnode'>" 
            //             + object.nodeValue.replace(/</g, "&lt;") + "</span>");
            //     }
            //     // CDATA Section
            //     else if (object.nodeType == 4) {
            //         insert(html, "<span class='cdata'>&lt;![CDATA[" 
            //             + object.nodeValue.replace(/</g, "&lt;") 
            //             + "]]&gt;</span>");
            //     }
            //     // Comment
            //     else if (object.nodeType == 11) {
            //         insert(html, "<span class='comment'>&lt;!--" 
            //             + object.nodeValue.replace(/</g, "&lt;") 
            //             + "--&gt;</span>");
            //     }
            //     // Element Node
            //     else if (object.nodeType == 1) {
            //         var node = ["&lt;" + object.tagName.toLowerCase()];
            //         for (var attr, i = 0, l = object.attributes.length; i < l; i++) {
            //             attr = object.attributes.item(i);
            //             node.push(attr.nodeName + "=\"" + attr.nodeValue.replace(/"/g, "&quot;") + "\"");
            //         }
            //         node = node.join(" ");
            //         node += object.childNodes.length ? "&gt;" : "&gt;&lt;/" 
            //             + object.tagName.toLowerCase() + "&gt;";
                    
            //         caption = document.createElement("span");
            //         insert(caption, node, name);
                    
            //         if (object.childNodes.length)
            //             insertTree(html, caption, object, parseChildren);
            //         else {
            //             caption.className = "emptynode";
            //             html.appendChild(caption);
            //         }
            //     }
            // }
            // Object
            else {
                var heading;
                if (object["$$error"]) {
                    object = object["$$error"];
                    heading   = (object.stack || "").split(":")[0];
                    heading = "<span class='err'>"
                        + object.message
                        + "</span>";
                    
                    caption = document.createElement("span");
                    insert(caption, heading, name);
                }
                else {
                    heading = (object.value || "[(anonymous function)]")
                        .replace(/^\[(.*)\]$/, "$1");
                    if (short === true) 
                        return insert(html, heading, name);
                
                    caption = document.createElement("span");
                    insert(caption, heading, name);
                    preview = caption.appendChild(document.createElement("span"));
                    preview.className = "preview";
                    
                    if (short !== 2) {
                        insert(preview, " {");
                        
                        props = object.properties || [];
                        count = 0;
                        for (var i = 0; count < 5 && i < props.length; i++) {
                            if ((props[i].name || "").indexOf("function") === 0)
                                continue;

                            insert(preview, (i !== 0 ? ", " : ""));
                            insert(preview, "", props[i].name);
                            renderType(props[i], preview, 2, true);
                            count++;
                        }
                        if (props.length > count)
                            insert(preview, "…");
                            
                        insert(preview, "}");
                    }
                    else {
                        insert(preview, "");
                    }
                }
                
                insertTree(html, caption, object, parseChildren);
            }
        }
        
        function canEvaluate(str) { 
            return str.trim() ? true : false; 
        };
        
        function evaluate(expression, cell, cb) {
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
            
            lastCell = cell;
            
            if (cell.html)
                cell.html.innerHTML = "";
            
            evaluateHeadless(expression, function(result){
                writeLog(result, "return", cell);
                cell.setWaiting(false);
            });

            //cb("Done");
        }
        
        function evaluateHeadless(expression, callback) {
            if (!callback) return;
            
            dbg && dbg.evaluate(expression, callstack.activeFrame, 
              !callstack.activeFrame, false, function(err, variable){
                if (err)
                    return callback({ "$$error" : err, type: err });
                
                if (variable.type == "function") {
                    dbg.serializeVariable(variable, function(value){
                        variable.name = value;
                        callback(variable);
                    });
                    return;
                }
                
                callback(variable);
            });
        }
        
        function getAllProperties(context, callback){
            evaluateHeadless(context, function(variable){
                if (variable["$$error"])
                    return callback(variable["$$error"]);
                if (!variable.properties)
                    return callback(null, []);
                    
                var results = variable.properties.map(function(m){
                    return m.name;
                });
                
                callback(null, results);
            });
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });
        plugin.on("canEvaluate", function(e){
            return canEvaluate(e.expression);
        });
        plugin.on("evaluate", function(e){
            return evaluate(e.expression, e.cell, e.callback);
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
        plugin.freezePublicAPI({
            /** @ignore */
            evaluateHeadless: evaluateHeadless,
            
            /** @ignore */
            getAllProperties: getAllProperties
        });
        
        register(null, {
            "immediate.debugnode": plugin
        });
    }
});