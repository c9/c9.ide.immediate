define(function(require, exports, module) {
    main.consumes = ["editors", "ui", "settings", "tabManager", "ace"];
    main.provides = ["immediate"];
    return main;

    function main(options, imports, register) {
        var editors  = imports.editors;
        // var settings = imports.settings;
        var tabs     = imports.tabManager;
        var ui       = imports.ui;
        
        var Repl     = require("plugins/c9.ide.ace.repl/repl").Repl;
        var markup   = require("text!./immediate.xml");
        
        var counter  = 0;
        
        /***** Initialization *****/
        
        var extensions = [];
        
        var handle = editors.register("immediate", "Immediate Window", 
                                      Immediate, extensions);
        var emit   = handle.getEmitter();
        
        var replTypes = {}; //Shared across Immediate windows
        
        handle.on("load", function(){
            handle.addElement(
                tabs.getElement("mnuEditors").appendChild(
                    new ui.item({
                        caption : "New Immediate Window",
                        onclick : function(e){
                            tabs.open({
                                active     : true,
                                pane        : this.parentNode.pane,
                                editorType : "immediate"
                            }, function(){});
                        }
                    })
                )
            );
            
            // Insert some CSS
            ui.insertCss(require("text!./style.css"), options.staticPrefix, handle);
        });
        
        /**
         * The immediate handle, provides an API for adding 
         * {@link immediate.evaluator evaluators} to the immediate panes. 
         * An evaluator is a plugin that can take the expressions typed in the
         * multi-line REPL like interface and return resuls. The results can be
         * rendered as HTML and are fully interactive.
         * 
         * This is the object you get when you request the immediate service 
         * in your plugin.
         * 
         * Example:
         * 
         *     define(function(require, exports, module) {
         *         main.consumes = ["immediate", "Plugin"];
         *         main.provides = ["myplugin"];
         *         return main;
         *     
         *         function main(options, imports, register) {
         *             var immediate = imports.immediate;
         *             var plugin    = new imports.Plugin("name", main.consumes);
         * 
         *             plugin.on("load", function(){
         *                 var evaluator = {
         *                     name        : "Go Language",
         *                     mode        : "ace/mode/go",
         *                     message     : "",
         *                     canEvaluate : function(str) { return str.trim() ? true : false; },
         *                     evaluate    : function(expression, cell, done) {
         *     
         *                         executeCommand(expression, function(result){
         *                             cell.addWidget({ 
         *                                 html       : "<div class='result'>" 
         *                                     + result + "</div>",
         *                                 coverLine  : true, 
         *                                 fixedWidth : true 
         *                             });
         *                             
         *                             done();
         *                         });
         *                     
         *                     }
         *                 };
         *     
         *                 immediate.addEvaluator("Go Language", "go", evaluator, plugin);
         *             });
         *         });
         *     });
         * 
         * 
         * @class immediate
         * @extends Plugin
         * @singleton
         */
        handle.freezePublicAPI({
            _events : [
                
            ],
            
            /**
             * Adds a new evaluator to all immediate panes. The user is able
             * to choose the evaluator from a dropdown in the UI of the 
             * immediate pane.
             * @param {String}              caption     The caption in the dropdown.
             * @param {String}              id          The unique identifier of this evaluator.
             * @param {immediate.evaluator} evaluator   The evaluator for your runtime.
             * @param {Plugin}              plugin      The plugin responsible for adding the evaluator.
             * @fires addType
             */
            addEvaluator : function(caption, id, evaluator, plugin){
                if (replTypes[id])
                    throw new Error("An evaluator is already registered with "
                        + "the id '" + id + "'");
                    
                replTypes[id] = {
                    caption   : caption, 
                    id        : id, 
                    evaluator : evaluator,
                    plugin    : plugin
                };
                emit("addType", replTypes[id]);
                
                plugin.addOther(function(){ 
                    emit("removeType", replTypes[id]);
                    delete replTypes[id]; 
                });
            },
            
            /**
             * 
             */
            findEvaluator : function(type, callback){
                if (!type || !replTypes[type]) {
                    handle.on("addType", function wait(e){
                        if (!type || e.id == type)
                            callback(e.id, replTypes[e.id].evaluator);
                        
                        handle.off("addType", wait);
                    });
                }
                else {
                    callback(type, replTypes[type].evaluator);
                }
            },
            
            /**
             * 
             */
            removeEvaluator : function(id){
                emit("removeType", replTypes[id]);
                delete replTypes[id];
            }
        });
        
        function Immediate(){
            var Baseclass = editors.findEditor("ace");
            
            var deps   = main.consumes.splice(0, main.consumes.length - 1);
            var plugin = new Baseclass(true, [], deps);
            // var emit   = plugin.getEmitter();
            
            var ddType, btnClear, ace;
            
            plugin.on("draw", function(e){
                // Create UI elements
                ui.insertMarkup(e.tab, markup, plugin);
                
                ddType    = plugin.getElement("ddType");
                btnClear  = plugin.getElement("btnClear");
                
                ace = plugin.ace;
                
                ace.setOption("printMargin", false);
                ace.setOption("scrollPastEnd", 0);
                ace.setOption("fontSize", 11);
                ace.setOption("showFoldWidgets", false);
                ace.setOption("highlightActiveLine", false);
                ace.setOption("highlightGutterLine", false);
                ace.container.style.lineHeight = "17px";
                
                e.htmlNode.className += " immediate";
                
                ddType.on("afterchange", function(){
                    if (currentDocument)
                        currentDocument.getSession().changeType(ddType.value);
                });
                btnClear.on("click", function(){
                    plugin.clear();
                });
                
                for (var type in replTypes){
                    var t = replTypes[type];
                    addType(t.caption, type, t.plugin);
                }
                
                handle.on("addType", function(e){
                    addType(e.caption, e.id, e.plugin);
                });
            });
            
            /***** Method *****/
            
            function addType(caption, value, plugin){
                var item = ddType.appendChild(new ui.item({
                    caption : caption,
                    value   : value
                }));
                
                plugin.addElement(item);
            }
            
            // Set the tab in loading state - later this could be the output block
            // currentDocument.tab.className.add("loading");
            // settings.save();
            
            /***** Lifecycle *****/
            
            plugin.on("load", function(){
            });
            
            var currentDocument;
            plugin.on("documentLoad", function(e){
                var doc     = e.doc;
                var session = doc.getSession();
                
                doc.undoManager.on("change", function(e){
                    if (!doc.undoManager.isAtBookmark())
                        doc.undoManager.bookmark();
                });
                
                doc.title = "Immediate";
                
                if (session.repl) return;
                
                session.changeType = function(type){
                    handle.findEvaluator(type, function(type, evaluator){
                        session.type = type;
                        
                        if (!session.repl) {
                            session.repl = new Repl(session.session, {
                                mode      : evaluator.mode,
                                evaluator : evaluator,
                                message   : evaluator.message
                            });
                            
                            if (currentDocument
                              && currentDocument.getSession() == session)
                                session.repl.attach(ace);
                        }
                        else {
                            session.repl.setEvaluator(evaluator);
                            session.repl.setMode(evaluator.mode);
                        }
                    });
                };
                
                session.changeType(session.type || ddType.value);
            });
            plugin.on("documentActivate", function(e){
                currentDocument = e.doc;
                var session = e.doc.getSession();
                
                if (session.type)
                    ddType.setValue(session.type);
                
                if (session.repl)
                    session.repl.attach(ace);
            });
            plugin.on("documentUnload", function(e){
                var session = e.doc.getSession();
                if (session.repl)
                    session.repl.detach();
                // TODO: this breaks moving repl between splits
                // delete session.repl;
            });
            plugin.on("getState", function(e){
                // @todo at one for each value container
                e.state.type      = e.doc.getSession().type;
            });
            plugin.on("setState", function(e){
                if (e.state.type)
                    ddType.setValue(e.state.type);
            });
            plugin.on("clear", function(){
            });
            plugin.on("focus", function(){
            });
            plugin.on("enable", function(){
            });
            plugin.on("disable", function(){
            });
            plugin.on("unload", function(){
            });
            
            /***** Register and define API *****/
            
            /**
             * Immediate Pane for Cloud9 IDE
             * @extends Editor
             */
            /**
             * The type of editor. Use this to create an immediate pane using
             * {@link tabManager#openEditor} or {@link editors#createEditor}.
             * @property {"immediate"} type
             * @readonly
             */
            plugin.freezePublicAPI({
                
            });
            
            plugin.load("immediate" + counter++);
            
            return plugin;
        }
        
        register(null, {
            immediate: handle
        });
    }
});