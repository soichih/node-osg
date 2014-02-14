var osg = require('../../index.js');
var fs = require('fs');
var path = require('path');

var temp = require('temp');

var condor = {
    //needed to run jobs on osg-xsede
    "+ProjectName": "CSIU",
    "+PortalUser": "hayashis",
    "Requirements": "(GLIDEIN_ResourceName =!= \"cinvestav\") && (GLIDEIN_ResourceName =!= \"SPRACE\") && (HAS_CVMFS_oasis_opensciencegrid_org =?= True) && (Memory >= 2000) && (Disk >= 500*1024*1024)"
}

osg.submit({
    executable: 'job.sh', //executable to send & run (usually a shell script)
    env: {name: "soichi"}, //env parameters used by run.js (part of wn)

    condor: condor,
    timeout: 60*10 //kill job in 10 minutes (should take less than seconds to run)
}, {
    //store input files (or symlinks) to be shipped for this job
    prepare: function(rundir, next) {
        console.log("using rundir:"+rundir);
        fs.symlink(path.resolve('job.js'), rundir+"/job.js", next);
    },

    submit: function(job, info) {
        console.dir(info);
        osg.q(job).then(function(data) {
            console.log("running on "+data.MATCH_EXP_JOB_Site);
        });
    },
    
    /*
    submit: function(job, event) {
        console.log("job submitted");
        console.dir(event);
    },
    execute: function(job, event) {
        console.log("job executing");
        console.dir(event);
    },
    */
    progress: function(job, event) {
        console.log("progressing / image_size");
        console.dir(event);

        //job.log.unwatch();
        //osg.remove(job);
        //osg.hold(job);
    },

    exception: function(job, event) {
        console.log("exception");
        console.dir(event);
        fs.readFile(job.options.output, 'utf8', function (err,data) {
            console.log(data);
        });
        fs.readFile(job.options.error, 'utf8', function (err,data) {
            console.log(data);
        });
    },
    /*
    held: function(job, event) {
        console.log("job held");
        //console.dir(job);
        console.dir(event);
        fs.readFile(job.options.output, 'utf8', function (err,data) {
            console.log(data);
        });
        fs.readFile(job.options.error, 'utf8', function (err,data) {
            console.log(data);
        });

        console.log("releasing job");
        osg.release(job);
    },
    */
    evicted: function(job, event) {
        console.log("job evicted");
        console.dir(event);
    },
    terminated: function(job, info) {
        console.dir(info);
        if(info.ret == 0) {
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
        job.log.unwatch();
    },
});
