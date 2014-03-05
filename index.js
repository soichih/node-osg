var events = require('events');
var extend = require('util')._extend;
var fs = require('fs');
var path = require('path');

var htcondor = require('htcondor');
var temp = require('temp');
var async = require('async');
var which = require('which');

//remove submit file created
temp.track();

//list of all workflow created via this module (used to remove all jobs on all workflows)
var workflows = [];

var Job = function(workflow) {
    //public variables
    this.id = null; //jobid. set when job is submitted
    this.workflow = workflow; //parent workflow (not used yet?)
    //this._submit = null; //submit info from condor

    //private variables
    var eventEmitter = new events.EventEmitter();
    var joblog = null; //set when job is submitted

    //var timeout = null; //started when job gets executed, and stopped when job gets held,aborted,terminated

    //public functions 
    this.on = function(event, callback) {
        eventEmitter.on(event, callback);
    }
    this.emit = function(event, data) {
        eventEmitter.emit(event, data);
    }
    this.remove = function(callback) {
        console.log("removing job:"+this.id);
        this.workflow.cleanup(this);
        return htcondor.remove(this.id, callback);
    }
    this.hold = function(callback) {
        return htcondor.hold(this.id, callback);
    }
    this.release = function(callback) {
        return htcondor.release(this.id, callback);
    }
    this.q = function(callback) {
        return htcondor.q(this.id, callback);
    }

    //not sure what I do with these yet,
    this.max_image_size = 0;
    this.max_memory_usage = 0;
    this.max_resident_set_size = 0;
}
exports.Job = Job;

var Workflow = function() {
    this.submitted = {}; //jobs are submitted (that we need to abort in case of SIGTERM/SIGINT) by this workflow

    this.runtime_stats = {
        hosts: {} //list of hosts where jobs are submitted (and counts for each return codes)
    };
    this.starttime = new Date();
    this.id = this.starttime.getTime(); //use starttime as id

    this.removed = false; 

    console.log("created workflow id:"+this.id+" :: monitor with condor_q -constraint node_osg_workflow_id==\\\""+this.id+"\\\"");
    workflows.push(this); //register this workflow to module workflow list
}
exports.Workflow = Workflow;

///////////////////////////////////////////////////////////////////////////////////////////////////
//
// for storing statistics
//
Workflow.prototype.get_runtime_stats = function(resource_name) {
    //init host stats
    if(!this.runtime_stats.hosts[resource_name]) { 
        this.runtime_stats.hosts[resource_name] = {
            total_walltime: 0,
            exceptions: [],
            errors: [],
            holds: [],
            counts: {}, //number of time it ran on this host
        }
    } 
    return this.runtime_stats.hosts[resource_name];
}
Workflow.prototype.store_runtime = function(job, info) {
    //console.log("adding runtime stats:"+job.id)
    var stat = this.get_runtime_stats(job.resource_name);
    stat.total_walltime += info.walltime;
    if(!stat.counts[info.ret]) {
        stat.counts[info.ret] = 0;
    }
    stat.counts[info.ret]++;
}
Workflow.prototype.store_exception = function(job, message) {
    var stat = this.get_runtime_stats(job.resource_name);
    stat.exceptions.push(message);
}
Workflow.prototype.store_reconnectfail = function(job, info) {
    var stat = this.get_runtime_stats(job.resource_name);
    stat.errors.push(info);
}
Workflow.prototype.store_hold = function(job, info) {
    var stat = this.get_runtime_stats(job.resource_name);
    stat.holds.push(info);
}
Workflow.prototype.print_runtime_stats = function(job, info) {
    var out = "";
    var total_jobs = 0;
    out += "---------------------------------------------------------------------------\n";
    out += "Workflow Statistics \n";
    out += "---------------------------------------------------------------------------\n";
    for(var host in this.runtime_stats.hosts) {
        var stat = this.runtime_stats.hosts[host];

        //count jobs
        var count_detail = "";
        var total_jobs_host = 0;
        for(var ret in stat.counts) {
            var count = stat.counts[ret];

            var code;
            switch(parseInt(ret)) {
            case 0: code = "success";break;
            case 1: code = "input error";break;
            case 2: code = "resource issue";break;
            case 9: code = "unknown blast error";break;
            case 10: code = "failed to load input";break;
            case 11: code = "invalid output";break;
            //TODO add others..
            default:
                code = "code:"+ret;

            }
            count_detail+= code+":"+count+" ";
            total_jobs_host += count;
        };

        total_jobs += total_jobs_host;

        //start output
        var avg_walltime = stat.total_walltime / total_jobs_host;
        out += host + " avg walltime per job(msec):"+avg_walltime+"\n";// jobs:"+total_jobs_host+"\n";
        out += count_detail+"\n";
        if(stat.exceptions.length > 0) {
            out += "Exception thrown on this site: "+stat.exceptions.length+"\n";
            stat.exceptions.forEach(function(exception) {
                out += exception+"\n";
            });
        }
        if(stat.holds.length > 0) {
            out += "Job held on this site: "+stat.holds.length+"\n";
            stat.holds.forEach(function(hold) {
                out += JSON.stringify(hold, null, 2)+"\n";
            });
        }
        if(stat.errors.length > 0) {
            out += "errors on this site: "+stat.errors.length+"\n";
            stat.errors.forEach(function(error) {
                out += JSON.stringify(error, null, 2)+"\n";
            });
        }
        out += "\n";
    }

    var duration = new Date() - this.starttime;

    //var avg_walltime = total_walltime/total_jobs;
    out += "---------------------------------------------------------------------------\n";
    //out += "Total Walltime(msec) of jobs:"+total_walltime+"\n";
    out += "Total Walltime(msec) of workflow:"+duration+"\n";
    out += "Total Jobs:"+total_jobs+"\n";
    //out += "Avg Walltime per job:"+avg_walltime+"\n";
    out += "---------------------------------------------------------------------------\n";
    return out;
}
//
//
///////////////////////////////////////////////////////////////////////////////////////////////////

Workflow.prototype.cleanup = function(job) {
    /*
    if(job.timeout) {
        clearTimeout(job.timeout);
        delete job.timeout;
    }
    */
    job.log.unwatch();
    delete this.submitted[job.id];
}

Workflow.prototype.submit = function(options) {
    var workflow = this;
    var job = new Job(this);

    //some default
    options = extend({
        something: 'hoge',
        send: [],
        receive: []
    }, options); 

    //initialize
    async.series([
        //create rundir if not specified (and call prepare if specified)
        function(next) {
            if(!options.rundir) {
                //just create an empty rundir
                temp.mkdir('node-osg.rundir', function(err, rundir) { 
                    if(err) throw err;
                    options.rundir = rundir;
                    next();
                });
            } else {
                //rundir specified by user.. but is it a function?
                if (typeof(options.rundir) == 'function') {
                    temp.mkdir('node-osg.rundir', function(err, rundir) { 
                        if(err) throw err;
                        //let user populate rundir
                        options.rundir(rundir, function() {
                            options.rundir = rundir;
                            next();
                        });
                    });
                }
            }
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

        /*
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
        */

        //create tmp stdout
        function(next) {
            if(options.stdout) {
                //user specified
                next();
            } else {
                options.stdout = options.rundir+"/stdout.out";
                next();
            }
        },

        //create tmp stderr
        function(next) {
            if(options.stderr) {
                next();
            } else {
                options.stderr = options.rundir+"/stderr.out";
                next();
            }
        },

        //list all files in rundir and send
        function(next) {
            fs.readdir(options.rundir, function(err, files) {
                options.send = [];
                files.forEach(function(file) {
                    options.send.push(file);
                });
                next();
            });
        }
    ], function() {
        var submit_options = {
            universe: 'vanilla',

            executable: options.executable,
            notification: 'never',

            initialdir: options.rundir,

            should_transfer_files: 'YES',
            when_to_transfer_output: 'ON_EXIT',

            output: options.stdout,
            error: options.stderr,
            "+node_osg_workflow_id": workflow.id,

            queue: 1
        };


        if(options.receive.length > 0) {
            submit_options.transfer_output_files = options.receive;
        }

        if(options.send.length > 0) {
            submit_options.transfer_input_files = options.send;
        }

        if(options.arguments) {
            //turn array arguments to a single string
            if(Array.isArray(options.arguments)) {
                options.arguments = options.arguments.join(" ");
            }
            submit_options.arguments = options.arguments;
        }
        if(options.description) {
            submit_options["+Description"] = options.description;
        }
        if(options.debug) {
            submit_options.debug = options.debug;
        }
        if(options.timeout) {//in msec
            if(submit_options.periodic_hold) {
                console.error("submit option periodic_hold and timeout collide - not setting timeout)");
            } else {
                submit_options.periodic_hold = "(JobStatus == 1 || JobStatus == 2) && (CurrentTime - EnteredCurrentStatus) > "+parseInt(options.timeout/1000);
                submit_options.periodic_hold_reason = "timeout set by user";
                submit_options.periodic_hold_subcode = 1;
            }
        }

        //add some condor override
        submit_options = extend(submit_options, options.condor);

        job.rundir = options.rundir;
        job.stdout = options.stdout;
        job.stderr = options.stderr;

        //finally, submit to condor
        htcondor.submit(submit_options).then(function(condorjob) {

            //set info..
            job.id = condorjob.id;
            job.log = condorjob.log;
            workflow.submitted[condorjob.id] = job;

            job.emit('submit', condorjob);

            //console.log("htcondor submitted..calling onevent");
            job.log.onevent(function(event) {
                if(workflow.removed) {
                    //ignore all further event - once we removed our workflow
                    return;
                }

                if(options.debug) {
                    //debug
                    console.dir(event);
                }

                //find callback to call
                switch(event.MyType) {
                /* start events are most likely already posted to joblog at the time we get here
                   so I don't *usually* get these events (tail can't rewind), although sometimes I get SubmitEvent
                   which is why I am sending my own submit event above.
                */
                case "GlobusSubmitEvent":
                case "GridSubmitEvent":
                case "SubmitEvent":
                    //console.log("received job events that I shouldn't be receiving..");
                    //console.dir(event);
                    break;

                //start status
                case "ExecuteEvent":
                    /*
                    { MyType: 'ExecuteEvent',
                      Proc: 0,
                      Cluster: 54627595,
                      EventTime: '2014-02-19T18:13:42',
                      ExecuteHost: '<192.41.230.230:60271?CCBID=129.79.53.179:9813#67680&noUDP>',
                      Subproc: 0,
                      EventTypeNumber: 1,
                      CurrentTime: 'expression:time()' }
                    */
                    job.starttime = new Date();

                    /*
                    if(options.timeout) {
                        if(job.timeout) {
                            console.log("this shouldn't happen, but timeout is already running on ExecutEvent.. clearing");
                            clearTimeout(job.timeout);
                        }
                        job.timeout = setTimeout(function() {
                            job.emit('timeout');
                            delete job.timeout; //necessary?
                        }, options.timeout);
                    }
                    */

                    job.q(function(err, info) {
                        //TODO - can we make this submit host generic?
                        if(!info.MATCH_EXP_JOBGLIDEIN_ResourceName) {
                            console.log("condor_q didn't return job info for ResourceName");    
                            console.dir(info);
                        } else {
                            job.resource_name = info.MATCH_EXP_JOBGLIDEIN_ResourceName;
                            job.machine_name = info.MachineAttrName0;
                        }

                        job.emit('execute', info);
                    });
                    break;
                //transitional
                case "JobImageSizeEvent":
                    /*
                    { Size: 1,
                      MyType: 'JobImageSizeEvent',
                      MemoryUsage: 3,
                      Proc: 0,
                      Cluster: 54628985,
                      EventTime: '2014-02-19T18:17:31',
                      Subproc: 0,
                      EventTypeNumber: 6,
                      CurrentTime: 'expression:time()',
                      ResidentSetSize: 2744 }
                    */
                    var info = {
                        Size: event.Size,
                        MemoryUsage: event.MemoryUsage,
                        ResidentSetSize: event.ResidentSetSize
                    };

                    //update max
                    if(job.max_image_size < event.Size) job.max_image_size = event.Size;
                    if(job.max_memory_usage < event.MemoryUsage) job.max_memory_usage = event.MemoryUsage;
                    if(job.max_resident_set_size < event.ResidentSetSize) job.max_resident_set_size = event.ResidentSetSize;

                    job.emit('imagesize', info);
                    job.emit('progress', info); //deprecated (use imagesize instead)
                    break; 
                case "ShadowExceptionEvent":
                    /*
                    if(job.timeout) {
                        console.log(job.id+" stopping timer due to exception on "+job.resource_name);
                        clearTimeout(job.timeout);
                        delete job.timeout;
                    }
                    */

                    if(job.resource_name) {
                        job.emit('exception', {
                            Message: event.Message
                        });
                        workflow.store_exception(job, event.Message);
                    } else {
                        //sometime exeption happens before execute event.. pull resource name so that I can
                        //report where the error message happens
                        job.q(function(err, info) {
                            job.resource_name = info.MATCH_EXP_JOBGLIDEIN_ResourceName;
                            job.machine_name = info.MachineAttrName0;
                            job.emit('exception', {
                                Message: event.Message
                            });
                            workflow.store_exception(job, event.Message);
                        });
                    }

                    break;

                case "JobReleaseEvent":
                    /*
                    { Reason: 'via condor_release (by user hayashis)',
                         MyType: 'JobReleaseEvent',
                         Proc: 0,
                         Cluster: 54627595,
                         EventTime: '2014-02-19T18:14:02',
                         Subproc: 0,
                         EventTypeNumber: 13,
                         CurrentTime: 'expression:time()' }
                    */
                    job.emit('release', {
                        Reason: event.Reason
                    });
                    break;

                case "JobDisconnectedEvent":
                    /*
                    <c>
                        <a n="EventDescription"><s>Job disconnected, attempting to reconnect</s></a>
                        <a n="StartdName"><s>glidein_39744@ri19n08.sandhills.hcc.unl.edu</s></a>
                        <a n="MyType"><s>JobDisconnectedEvent</s></a>
                        <a n="StartdAddr"><s>&lt;10.147.14.8:47407?CCBID=129.79.53.179:9808#71610&amp;noUDP&gt;</s></a>
                        <a n="Proc"><i>0</i></a>
                        <a n="Cluster"><i>55226309</i></a>
                        <a n="EventTime"><s>2014-02-27T19:09:53</s></a>
                        <a n="Subproc"><i>0</i></a>
                        <a n="EventTypeNumber"><i>22</i></a>
                        <a n="CurrentTime"><e>time()</e></a>
                        <a n="DisconnectReason"><s>Socket between submit and execute hosts closed unexpectedly</s></a>
                    </c>

                    */
                    job.emit('disconnect', {
                        EventDescription: event.EventDescription,
                        StartdName: event.StartdName,
                        StartdAddr: event.StartdAddr,
                        DisconnectReason: event.DisconnectReason
                    });
                    break;

                case "JobReconnectFailedEvent":
                    /*
                    <c>
                        <a n="EventDescription"><s>Job reconnect impossible: rescheduling job</s></a>
                        <a n="Reason"><s>Job disconnected too long: JobLeaseDuration (1200 seconds) expired</s></a>
                        <a n="StartdName"><s>glidein_39744@ri19n08.sandhills.hcc.unl.edu</s></a>
                        <a n="MyType"><s>JobReconnectFailedEvent</s></a>
                        <a n="Proc"><i>0</i></a>
                        <a n="Cluster"><i>55226309</i></a>
                        <a n="EventTime"><s>2014-02-27T19:29:53</s></a>
                        <a n="Subproc"><i>0</i></a>
                        <a n="EventTypeNumber"><i>24</i></a>
                        <a n="CurrentTime"><e>time()</e></a>
                    </c>
                    */
                    /*
                    if(job.timeout) {
                        console.log(job.id+" stopping timer due to reconnection failure on "+job.resource_name);
                        clearTimeout(job.timeout);
                        delete job.timeout;
                    }
                    */
                    var info = {
                        EventDescription: event.EventDescription,
                        Reason: event.Reason,
                        StartdName: event.StartdName
                    };
                    job.emit('reconnectfail', info);
                    workflow.store_reconnectfail(job, info);
                    break;
                case "JobEvictedEvent": 
                    //called if someone call condor_hold 
                    //I am not sure if this fired when someone remove() job, but since we stop log.watch, we won't emit evict in any case
                    /*
                    { Proc: 0,
                         EventTime: '2014-02-20T01:27:36',
                         RunRemoteUsage: 'Usr 0 00:00:00, Sys 0 00:00:00',
                         RunLocalUsage: 'Usr 0 00:00:00, Sys 0 00:00:00',
                         SentBytes: 0,
                         MyType: 'JobEvictedEvent',
                         TerminatedAndRequeued: false,
                         Checkpointed: false,
                         Cluster: 54671750,
                         Subproc: 0,
                         CurrentTime: 'expression:time()',
                         EventTypeNumber: 4,
                         TerminatedNormally: false,
                         ReceivedBytes: 702 }
                    */

                    /*
                    if(job.timeout) {
                        //still not sure if I need to stop timer for this.. but I feel like I should
                        //console.log("hold call back should handle timeout, so not sure if this is necessary, but... just in case");
                        clearTimeout(job.timeout);
                        delete job.timeout;
                    }
                    */

                    job.emit('evict', {
                        SentBytes: event.SentBytes,
                        TerminatedAndRequeued: event.TerminatedAndRequeued,
                        Checkpointed: event.Checkpointed,
                        TerminatedNormally: event.TerminatedNormally,
                        ReceivedBytes: event.ReceivedBytes
                    });
                    break;

                //pause status
                case "JobHeldEvent":
                    /*
                    <c>
                        <a n="HoldReasonCode"><i>1</i></a>
                        <a n="MyType"><s>JobHeldEvent</s></a>
                        <a n="Proc"><i>0</i></a>
                        <a n="Cluster"><i>54627270</i></a>
                        <a n="EventTime"><s>2014-02-19T18:06:34</s></a>
                        <a n="HoldReasonSubCode"><i>0</i></a>
                        <a n="Subproc"><i>0</i></a>
                        <a n="EventTypeNumber"><i>12</i></a>
                        <a n="HoldReason"><s>via condor_hold (by user hayashis)</s></a>
                        <a n="CurrentTime"><e>time()</e></a>
                    </c>
                    */
                    /*
                    if(job.timeout) {
                        clearTimeout(job.timeout);
                        delete job.timeout;
                    }
                    */
                    var info = {
                        HoldReasonCode: event.HoldReasonCode,
                        HoldReasonSubCode: event.HoldReasonSubCode,
                        HoldReason: event.HoldReason
                    };
                    workflow.store_hold(job, info);
                    job.emit('hold', info);
                    break;

                //terminal status (need to stop timer and cleanup the job)
                case "JobAbortedEvent":
                    /*
                    { Reason: 'via condor_rm (by user hayashis)',
                      MyType: 'JobAbortedEvent',
                      Proc: 0,
                      Cluster: 54629517,
                      EventTime: '2014-02-19T18:18:23',
                      Subproc: 0,
                      EventTypeNumber: 9,
                      CurrentTime: 'expression:time()' }
                    */
                    job.emit('abort', {
                        Reason: event.Reason
                    });
                    workflow.cleanup(job);
                    break;
                case "JobTerminatedEvent":
                    job.endtime = new Date();

                    var info = {
                        ret: event.ReturnValue,
                        walltime: job.endtime - job.starttime
                    };
                    workflow.store_runtime(job, info);
                    job.emit('terminate', info);
                    workflow.cleanup(job);
                    break;
                default:
                    console.log("unknown event type:"+event.MyType);
                }
            });
        }).catch(function(err) {
            job.emit('submitfail', err);
        });
    });

    return job;
}

/*
//abort any jobs that are still submitted
Workflow.prototype.removeall = function() {
    var jobs = [];
    for(var id in this.submitted) {
        var job = this.submitted[id];
        jobs.push(job);
    }
    //remove 10 jobs max at a time (so that I won't exceed ulimit -u)
    async.eachLimit(jobs, 10, function(job, next) {
        job.remove(next);
    }, function(err) {
        //all done..
        //this.submitted = []; //remove should take care of removing job

        //assert..
        //if(Object.keys(this.submitted).length != 0) {
        //    console.log("workflow.submitted still contains some jobs.. this shoudn't have happened.");
        //}
    });
} 
*/

Workflow.prototype.remove = function() {
    if(this.removed) {
        //workflow already removed - no reason to do this again
        return;
    }
    this.removed = true;

    //console.log("aborting all jobs in this workflow with id:"+this.id);
    htcondor.remove(['-constraint', 'node_osg_workflow_id=="'+this.id+'"']);

    //need to cleanup all jobs
    for(var id in this.submitted) {
        var job = this.submitted[id];
        this.cleanup(job);
    }
}
    
//remove all jobs on all workflows
process.on('SIGINT', function() {
    console.log("node-osg received SIGINT(ctrl+c)");
    workflows.forEach(function(workflow) {
        workflow.remove();
    });
});
process.on('SIGTERM', function() {
    console.log("node-osg received SIGTERM(kill)");
    workflows.forEach(function(workflow) {
        workflow.remove();
    });
});

