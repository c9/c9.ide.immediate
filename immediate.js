define(function(require, exports, module) {
    main.consumes = [
        "editors", "ui", "settings", "tabManager", "ace", "menus", "commands",
        "console"
    ];
    main.provides = ["immediate"];
    return main;

    function main(options, imports, register) {
        var editors   = imports.editors;
        var settings  = imports.settings;
        var tabs      = imports.tabManager;
        var ui        = imports.ui;
        var menus     = imports.menus;
        var commands  = imports.commands;
        var c9console = imports.console;
        
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
                                pane       : this.parentNode.pane,
                                editorType : "immediate"
                            }, function(){});
                        }
                    })
                )
            );

            menus.addItemByPath("Window/New Immediate Window", new ui.item({
                onclick : function(){
                    tabs.open({
                        active     : true,
                        pane       : this.parentNode.pane,
                        editorType : "immediate"
                    }, function(){});
                }
            }), 31, handle);
            
            commands.addCommand({
                name    : "showimmediate",
                group   : "Panels",
                exec    : function (editor) {
                    // Search for the output pane
                    if (search()) return;
                    
                    // If not found show the console
                    c9console.show();
                    
                    // Search again
                    if (search()) return;
                    
                    // Else open the output panel in the console
                    tabs.open({
                        editorType : "immediate", 
                        active     : true,
                        pane        : c9console.getPanes()[0],
                    }, function(){});
                }
            }, handle);
            
            // Insert some CSS
            ui.insertCss(require("text!./style.css"), options.staticPrefix, handle);
        });
        
        //Search through pages
        function search(){
            return !tabs.getTabs().every(function(tab){
                if (tab.editorType == "immediate") {
                    tabs.focusTab(tab);
                    return false;
                }
                return true;
            });
        }
        
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
                ace.setOption("showFoldWidgets", false);
                ace.setOption("highlightActiveLine", false);
                ace.setOption("highlightGutterLine", false);
                // ace.setOption("fontSize", 11);
                // ace.container.style.lineHeight = "17px";
                
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
                
                handle.on("addEvaluator", function(e){
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
                            session.repl.session.setMode(evaluator.mode);
                        }
                    });
                };
                
                session.changeType(session.type || ddType.value);
            });
            plugin.on("documentActivate", function(e){
                currentDocument = e.doc;
                var session = e.doc.getSession();
                
                if (session.type) {
                    ddType.setValue(session.type);
                    ddType.dispatchEvent("afterchange");
                }
                
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
                if (e.state.type) {
                    e.doc.getSession().type = e.state.type;
                    ddType.setValue(e.state.type);
                    ddType.dispatchEvent("afterchange");
                }
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
             * @class immediate.Immediate
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
        
        /**
         * The immediate handle, provides an API for adding 
         * {@link Evaluator evaluators} to the immediate panes. 
         * An evaluator is a plugin that can take the expressions from the
         * multi-line REPL and return resuls. The results can be
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
         *             var plugin    = new imports.Plugin("Your Name", main.consumes);
         * 
         *             plugin.on("load", function(){
         *                 var evaluator = {
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
                /**
                 * Fires when an evaluator is added.
                 * @event addEvaluator
                 * @param {Object}              e
                 * @param {String}              e.caption     The caption of the evaluator.
                 * @param {String}              e.id          The unique identifier of the evaluator.
                 * @param {Evaluator} e.evaluator   The evaluator.
                 * @param {Plugin}              e.plugin      The plugin responsible for adding the evaluator.
                 */
                "addEvaluator",
                /**
                 * Fires when an evaluator is removed.
                 * @event removeEvaluator
                 * @param {Object}              e
                 * @param {String}              e.caption     The caption of the evaluator.
                 * @param {String}              e.id          The unique identifier of the evaluator.
                 * @param {Evaluator} e.evaluator   The evaluator.
                 * @param {Plugin}              e.plugin      The plugin responsible for adding the evaluator.
                 */
                "removeEvaluator"
            ],
            
            /**
             * Adds a new evaluator to all immediate panes. The user is able
             * to choose the evaluator from a dropdown in the UI of the 
             * immediate pane.
             * @param {String}              caption     The caption in the dropdown.
             * @param {String}              id          The unique identifier of this evaluator.
             * @param {Evaluator} evaluator   The evaluator for your runtime.
             * @param {Plugin}              plugin      The plugin responsible for adding the evaluator.
             * @fires addEvaluator
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
                emit("addEvaluator", replTypes[id]);
                
                plugin.addOther(function(){ 
                    handle.removeEvaluator(id);
                });
            },
            
            /**
             * Retrieves an evaluator based on it's id. When the evaluator is
             * not yet registered, the callback will be returned when the 
             * evaluator is registered.
             * @param {String}              id                  The id of the evaluator to retrieve.
             * @param {Function}            callback            Called when the evaluator is available.
             * @param {Error}               callback.id         The id of the requested evaluator.
             * @param {Evaluator} callback.evaluator  The evaluator requested.
             */
            findEvaluator : function(id, callback){
                if (!id || !replTypes[id]) {
                    handle.on("addEvaluator", function wait(e){
                        if (!id || e.id == id)
                            callback(e.id, replTypes[e.id].evaluator);
                        
                        handle.off("addEvaluator", wait);
                    });
                }
                else {
                    callback(id, replTypes[id].evaluator);
                }
            },
            
            /**
             * Removes an evaluator from all immediate panes.
             * @param {String} id  The unique identifier of the evaluator to remove.
             */
            removeEvaluator : function(id){
                emit("removeEvaluator", replTypes[id]);
                delete replTypes[id];
            }
        });
        
        register(null, {
            immediate: handle
        });
    }
});