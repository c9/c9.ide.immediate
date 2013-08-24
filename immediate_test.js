/*global describe it before after  =*/

require(["lib/architect/architect", "lib/chai/chai", "/vfs-root"], 
  function (architect, chai, baseProc) {
    var expect = chai.expect;
    
    var runners  = {
        "node" : {
            "caption" : "Node.js (current)",
            "cmd": ["node", "$file"],
            "debug": ["--debug-brk=5454"],
            "file_regex": "^[ ]*File \"(...*?)\", line ([0-9]*)",
            "selector": "source.python",
            "info": "Your code is running at \\033[01;34m$hostname\\033[00m.\n"
                + "\\033[01;31mImportant:\\033[00m use \\033[01;32mprocess.env.PORT\\033[00m as the port and \\033[01;32mprocess.env.IP\\033[00m as the host in your scripts!\n"
        },
        "pythoni" : {
            "caption" : "Python in interactive mode",
            "cmd": ["python", "-i"],
            "selector": "source.python",
            "info": "Hit \\033[01;34mCtrl-D\\033[00m to exit.\n"
        }
    };
    
    architect.resolveConfig([
        {
            packagePath : "plugins/c9.core/c9",
            workspaceId : "ubuntu/ip-10-35-77-180",
            startdate   : new Date(),
            debug       : true,
            smithIo     : "{\"prefix\":\"/smith.io/server\"}",
            hosted      : true,
            local       : false,
            hostname    : "dev.javruben.c9.io",
            davPrefix   : "/"
        },
        
        "plugins/c9.core/ext",
        "plugins/c9.core/events",
        "plugins/c9.core/http",
        "plugins/c9.core/util",
        "plugins/c9.ide.ui/anims",
        "plugins/c9.ide.ui/lib_apf",
        {
            packagePath : "plugins/c9.core/settings",
            settings : "<settings><state><console>" + JSON.stringify({
                type  : "tab", 
                nodes : [
                    {
                        type : "page",
                        editorType : "immediate",
                        active : "true"
                    }
                ]
            }) + "</console></state></settings>"
        },
        {
            packagePath  : "plugins/c9.ide.ui/ui",
            staticPrefix : "plugins/c9.ide.ui"
        },
        "plugins/c9.ide.editors/document",
        "plugins/c9.ide.editors/undomanager",
        "plugins/c9.ide.editors/editors",
        "plugins/c9.ide.editors/editor",
        {
            packagePath : "plugins/c9.ide.editors/tabs",
            testing     : 2
        },
        "plugins/c9.ide.editors/tab",
        "plugins/c9.ide.editors/page",
        "plugins/c9.ide.ace/ace",
        {
            packagePath: "plugins/c9.ide.immediate/immediate",
            staticPrefix : "plugins/c9.ide.layout.classic"
        },
        "plugins/c9.ide.immediate/evaluators/js-current-browser",
        "plugins/c9.ide.console/console",
        "plugins/c9.fs/proc",
        "plugins/c9.fs/fs",
        {
            packagePath: "plugins/c9.vfs.client/vfs_client",
            smithIo     : {
                "prefix": "/smith.io/server"
            }
        },
        "plugins/c9.ide.auth/auth",
        "plugins/c9.ide.keys/commands",
        {
            packagePath : "plugins/c9.ide.run/run",
            testing     : true,
            base        : baseProc,
            runners     : runners
        },
        
        // Mock plugins
        {
            consumes : ["emitter", "apf", "ui"],
            provides : [
                "menus", "layout", "watcher", 
                "save", "fs", "preferences", "clipboard"
            ],
            setup    : expect.html.mocked
        },
        {
            consumes : ["immediate", "tabs"],
            provides : [],
            setup    : main
        }
    ], function (err, config) {
        if (err) throw err;
        var app = architect.createApp(config);
        app.on("service", function(name, plugin){ plugin.name = name; });
    });
    
    function main(options, imports, register) {
        var immediate = imports.immediate;
        var tabs      = imports.tabs;
        
        expect.html.setConstructor(function(page){
            if (typeof page == "object")
                return page.tab.aml.getPage("editor::" + page.editorType).$ext;
        });
        
        function countEvents(count, expected, done){
            if (count == expected) 
                done();
            else
                throw new Error("Wrong Event Count: "
                    + count + " of " + expected);
        }
        
        describe('immediate', function() {
            before(function(done){
                apf.config.setProperty("allow-select", false);
                apf.config.setProperty("allow-blur", false);

                bar.$ext.style.background = "rgba(220, 220, 220, 0.93)";
                bar.$ext.style.position = "fixed";
                bar.$ext.style.left = "20px";
                bar.$ext.style.right = "20px";
                bar.$ext.style.bottom = "20px";
                bar.$ext.style.height = "150px";
      
                document.body.style.marginBottom = "150px";
                
               // for (var name in runners) {
               //     immediate.addType(name.uCaseFirst(), name);
               // }
                
                done();
            });
            
            describe("addType(), on.evaluate", function(){
                it('should add an item to the dropdown and run it', function(done) {
                    // var inp = tabs.focussedPage.editor.getElement("txtInput");
                    // inp.setValue("1+1");
                    // inp.dispatchEvent("keydown", {keyCode: 13});
                    done();
                });
            });
            
            // after(function(done){
            //     tabs.unload();
            //     bar.parentNode.removeChild(bar);
            //     
            //     document.body.style.marginBottom = "";
            //     done();
            // });
        });
        
        onload && onload();
    }
});