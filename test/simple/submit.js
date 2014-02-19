var osg = require('../../index.js');
var fs = require('fs');
var path = require('path');

var temp = require('temp');

var condor = {
    //needed to run jobs on osg-xsede
    "+ProjectName": "CSIU",
    "+PortalUser": "hayashis",
    "Requirements": "(GLIDEIN_ResourceName =!= \"cinvestav\") && (GLIDEIN_ResourceName =!= \"SPRACE\") && (GLIDEIN_ResourceName =!= \"Nebraska\") && (HAS_CVMFS_oasis_opensciencegrid_org =?= True) && (Memory >= 2000) && (Disk >= 100*1024*1024)"
}

var events = osg.submit({
    executable: 'job.sh', //executable to send & run (usually a shell script)
    env: {name: "soichi"}, //env parameters used by run.js (part of wn)

    //receive: ['nothing'],
    condor: condor,
    timeout: 15*1000, //(timer will stop if job terminates, hold, etc)
    //call to place files in rundir before submitting. any files / symlinks created here will be send to the remote job
    rundir: function(rundir, next) {
        console.log("using rundir:"+rundir);
        fs.symlink(path.resolve('job.js'), rundir+"/job.js", next);
    }
});

events.on('submit', function(job) {
    console.log("submitted");
    console.dir(job.id);
});
events.on('execute', function(job, info) {
    console.log("job executing");
    console.dir(info);
    osg.q(job).then(function(data) {
        console.log("running on "+data.MATCH_EXP_JOB_Site);
    });
});
events.on('progress', function(job, info) {
    console.log("progressing / image_size");
    console.dir(info);
});
events.on('exception', function(job, info) {
    console.log("exception");
    console.dir(info);
    /*
    fs.readFile(job.options.output, 'utf8', function (err,data) {
        console.log(data);
    });
    fs.readFile(job.options.error, 'utf8', function (err,data) {
        console.log(data);
    });
    */
});
events.on('timeout', function(job, info) {
    console.log("job timedout - removing");
    console.dir(info);
    //osg.remove(job);
    osg.hold(job);
});
events.on('evict', function(job, info) {
    console.log("job evicted");
    console.dir(info);
});
events.on('release', function(job, info) {
    console.log("job released");
    console.dir(info);
});
events.on('hold', function(job, info) {
    console.log("job held");
    console.dir(info);
    osg.release(job);
});
events.on('terminate', function(job, info) {
    console.log("job terminateD");
    console.dir(info);
    if(info.ret == 0) {
        fs.readFile(job.options.output, 'utf8', function (err,data) {
            console.log(data);
        }); 
        fs.readFile(job.options.error, 'utf8', function (err,data) {
            console.log(data);
        }); 
        fs.readFile(info.rundir+"/output.txt", 'utf8', function(err, data) {
            if(err) throw err;
            console.log(data.substring(0, 3000));
        });
    } else {
        fs.readFile(job.options.output, 'utf8', function (err,data) {
            console.log(data);
        }); 
        fs.readFile(job.options.error, 'utf8', function (err,data) {
            console.log(data);
        }); 
    }
});
