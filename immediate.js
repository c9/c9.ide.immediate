/**
 * Immediate Execution Editor for Cloud9 IDE
 *
 * @copyright 2010, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
define(function(require, exports, module) {
    main.consumes = ["editors", "ui", "settings", "tabs", "ace"];
    main.provides = ["immediate"];
    return main;

    function main(options, imports, register) {
        var editors  = imports.editors;
        // var settings = imports.settings;
        var tabs     = imports.tabs;
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
                                tab        : this.parentNode.tab,
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
         * 
         */
        handle.freezePublicAPI({
            /**
             * 
             */
            addType : function(name, value, evaluator, plugin){
                if (replTypes[value])
                    throw new Error("Type is already registered");
                    
                replTypes[value] = {
                    name      : name, 
                    value     : value, 
                    evaluator : evaluator,
                    plugin    : plugin
                };
                emit("addType", replTypes[value]);
                
                plugin.addOther(function(){ 
                    emit("removeType", replTypes[value]);
                    delete replTypes[value]; 
                });
            },
            
            /**
             * 
             */
            findEvaluator : function(type, callback){
                if (!type || !replTypes[type]) {
                    handle.on("addType", function wait(e){
                        if (!type || e.value == type)
                            callback(e.value, replTypes[e.value].evaluator);
                        
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
            removeType : function(value){
                emit("removeType", replTypes[value]);
                delete replTypes[value];
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
                ui.insertMarkup(e.page, markup, plugin);
                
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
                    addType(t.name, type, t.plugin);
                }
                
                handle.on("addType", function(e){
                    addType(e.name, e.value, e.plugin);
                });
            });
            
            /***** Method *****/
            
            function addType(name, value, plugin){
                var item = ddType.appendChild(new ui.item({
                    caption : name,
                    value   : value
                }));
                
                plugin.addElement(item);
            }
            
            // Set the page in loading state - later this could be the output block
            // currentDocument.page.className.add("loading");
            // settings.save();
            
            /***** Lifecycle *****/
            
            plugin.on("load", function(){
            });
            
            var currentDocument;
            plugin.on("document.load", function(e){
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
            plugin.on("document.activate", function(e){
                currentDocument = e.doc;
                var session = e.doc.getSession();
                
                if (session.type)
                    ddType.setValue(session.type);
                
                if (session.repl)
                    session.repl.attach(ace);
            });
            plugin.on("document.unload", function(e){
                var session = e.doc.getSession();
                if (session.repl)
                    session.repl.detach();
                // TODO: this breaks moving repl between splits
                // delete session.repl;
            });
            plugin.on("state.get", function(e){
                // @todo at one for each value container
                e.state.type      = e.doc.getSession().type;
            });
            plugin.on("state.set", function(e){
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
             * Read Only Image Editor
             **/
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