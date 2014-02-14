var extend = require('util')._extend;
var fs = require('fs');
var path = require('path');

var htcondor = require('htcondor');
var temp = require('temp');
var async = require('async');
var which = require('which');

//remove submit file created
temp.track();

//keep track of which jobs are running (that we need to abort in case of SIGTERM/SIGINT)
var running = {};

/*
//some default osg options
var osg_options = {
    env: {}
};
*/

/*
exports.init = function(options, callback) {
    osg_options = extend(osg_options, options);

    //nothing to initialize yet
    callback();
}
*/

exports.submit = function(options, callbacks) {

    //some default
    options = extend({
        something: 'hoge',
        receive: []
    }, options); 

    /*
    //turn relative path to absolute 
    options.send.forEach(function(send) {
        if(send[0] != "/") { //TODO is this 
        
        }
    });
    */

    //options.send.push(__dirname+"/wn/osg");
    //options.send.push(__dirname+"/wn/run.js");

    //always receive jobstats.csv
    //options.receive.push('jobstats.txt');

    //initialize
    async.series([
        /*
        //send git executable
        function(next) {
            which('git', function(err, path) {
                if(err) {
                    console.log("can't find git. please install it on the submit host");
                } else {
                    options.send.push(path);
                    next();
                }
            });
        },
        */
        /* -- TODO not that we are using initialdir, all path needs to be absolute
        //package.json
        function(next) {
            fs.exists('package.json', function(exists) {
                if(exists) {
                    options.send.push("package.json");
                }
                next();
            });
        },
        */

        //create rundir
        function(next) {
            //console.log('start mkdir');
            temp.mkdir('node-osg.rundir', function(err, rundir) { 
                if(err) throw err;
                options.rundir = rundir;
                if(callbacks.prepare) {
                    callbacks.prepare(rundir, next);
                } else {
                    next();
                }
            });
        },

        /*
        //symlink all relative input files to rundir
        function(next) {
            //console.log('start symlink');
            if(options.send) {
                var send_basenames = [];
                async.forEach(options.send, function(send, next_send) {
                    //if(send[0] != "/") {
                    //always resolve send path
                    var from = path.resolve(send);
                    send_basename = path.basename(send);
                    send_basenames.push(send_basename);
                    //console.log("symlinking from "+from+" to "+options.rundir+"/"+send_basename);
                    fs.symlink(from, options.rundir+"/"+send_basename, next_send);
                    //TODO check to see file actually exists?
                }, function() {
                    options.send = send_basenames;
                    next();
                });
            } else {
                next();
            }
        },
        */

        //create tmp options.json (used to send options to wn)
        function(next) {
            fs.open(options.rundir+"/options.json", 'w', function(err, fd) { 
                if(err) throw err;
                fs.write(fd, JSON.stringify(options));
                //options.run = path.basename(ojson.path)+" "+options.run;
                //options.send.push("options.json");
                fs.close(fd, next);
            });
        },

        //create tmp stdout
        function(next) {
            if(options.stdout) {
                //user specified
                next();
            } else {
                //creat temp one
                temp.open("osg-stdout.", function(err, tmp) { 
                    if(err) throw err;
                    options.stdout = tmp.path; 
                    next();
                });
            }
        },

        //create tmp stderr
        function(next) {
            if(options.stderr) {
                next();
            } else {
                temp.open('osg-stderr.', function(err, tmp) { 
                    if(err) throw err;
                    options.stderr = tmp.path; 
                    next();
                });
            }
        },

        //list all files in rundir and send
        function(next) {
            fs.readdir(options.rundir, function(err, files) {
                options.send = [];
                files.forEach(function(file) {
                    //console.log("senging:"+ file);
                    options.send.push(file);
                });
                next();
            });
        }
    ], function() {
        //turn array arguments to a single string
        if(Array.isArray(options.arguments)) {
            options.arguments = options.arguments.join(" ");
        }

        //construct htcondor options
        console.log('submitting');
        var submit_options = {
            universe: 'vanilla',

            //executable: __dirname+'/wn/boot.sh',
            //arguments: options.run,

            executable: options.executable,
            arguments: options.arguments,
            notification: 'never',

            initialdir: options.rundir,

            should_transfer_files: 'YES',
            when_to_transfer_output: 'ON_EXIT',
            transfer_input_files: options.send,
            transfer_output_files: options.receive,

            output: options.stdout,
            error: options.stderr,

            queue: 1
        };

        //add some condor override
        submit_options = extend(submit_options, options.condor);

        //console.dir(submit_options);

        htcondor.submit(submit_options).then(function(job) {

            //short hand for options.initialdir.. (should I really do this??)
            //job.rundir = options.rundir;

            running[job.id] = job;
            job.log.watch(function(event) {
                var callback = undefined;
                var info = {/*_event: event*/}; //I might get rid of _event after all useful information is processed

                //find callback to call
                switch(event.MyType) {
                //start status
                case "GlobusSubmitEvent":
                case "GridSubmitEvent":
                case "SubmitEvent":
                    callback = callbacks.submit; 
                    break;

                //midle status
                case "ExecuteEvent":
                    callback = callbacks.execute;
                    break;
                case "JobImageSizeEvent":
                    callback = callbacks.progress; 
                    info.Size = event.Size;
                    info.MemoryUsage = event.MemoryUsage;
                    info.ResidentSetSize = event.ResidentSetSize;
                    break; 
                case "ShadowExceptionEvent":
                    callback = callbacks.exception; 
                    info.Message = event.Message;
                    break;
                case "JobHeldEvent":
                    callback = callbacks.held; break;
                case "JobEvictedEvent":
                    callback = callbacks.evicted; break;
                case "JobReleaseEvent":
                    callback = callbacks.released; break;
                case "JobDisconnectedEvent":
                    callback = callbacks.disconnected; break;

                //terminal status
                case "JobAbortedEvent":
                    callback = callbacks.aborted; 

                    delete running[job.id];
                    job.log.unwatch();

                    break;
                case "JobTerminatedEvent":
                    callback = callbacks.terminated; 

                    delete running[job.id];
                    job.log.unwatch();

                    info.rundir = options.rundir;
                    info.ret = event.ReturnValue;
                    job.log.unwatch();
                    break;

                default:
                    console.log("unknown event type:"+event.MyType);
                }

                if(callback) {
                    callback(job, info);
                } else {
                    //TODO - dump un-handled event if it's on debug
                    //console.dir(event);
                }
            });
        }).done(function(err) {
            if(err) throw err;
        });
    });
}

//just wrappers around htcondor.
exports.remove = function(job, callback) {
    console.log("removing job:"+job.id);
    return htcondor.remove(job, callback);
}
exports.hold = function(job, callback) {
    return htcondor.hold(job, callback);
}
exports.release = function(job, callback) {
    return htcondor.release(job, callback);
}
exports.q = function(job, callback) {
    return htcondor.q(job, callback);
}

//abort any jobs that are still running
exports.removeall = function() {
    for(var id in running) {
        var job = running[id];
        exports.remove(job);
    }
}

process.on('SIGINT', function() {
    exports.removeall();
});

process.on('SIGTERM', function() {
    exports.removeall();
})
