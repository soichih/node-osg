var osg = require('../../index.js');
var fs = require('fs');

osg.init({
    submit: { "+ProjectName": "CSIU" } //needed to run jobs on osg-xsede
}, function() {
    submit();
});

function submit() {
    osg.submit({
        send: ['blast.sh', 'blastx', 'nr.100.fasta'],  
        receive: ['output.xml'],  
        run: './blast.sh',
        timeout: 120 //kill job if it doesn't finish in 60 seconds
    }, {
        /*
        submit: function(job, event) {
            console.log("job submitted");
            console.dir(event);
        },
        execute: function(job, event) {
            console.log("job executing");
            console.dir(event);
        },
        image_size: function(job, event) {
            console.log("image_size");
            console.dir(event);
        },
        */
        exception: function(job, event) {
            console.log("exception");
            console.dir(event);
            fs.readFile(job.options.output, 'utf8', function (err,data) {
                console.log(data);
            }); 
            fs.readFile(job.options.error, 'utf8', function (err,data) {
                console.log(data);
            }); 

            job.log.unwatch();
        },
        held: function(job, event) {
            console.log("job held");
            console.dir(job);
            console.dir(event);
            fs.readFile(job.options.output, 'utf8', function (err,data) {
                console.log(data);
            }); 
            fs.readFile(job.options.error, 'utf8', function (err,data) {
                console.log(data);
            }); 

            job.log.unwatch();

            console.log("removing job");
            osg.remove(job);
        },
        evicted: function(job, event) {
            console.log("job evicted");
            console.dir(event);
            fs.readFile(job.options.output, 'utf8', function (err,data) {
                console.log(data);
            }); 
            fs.readFile(job.options.error, 'utf8', function (err,data) {
                console.log(data);
            }); 

            job.log.unwatch();
        },
        terminated: function(job, event) {
            console.log("job terminated with return code:"+event.ReturnValue);
            console.dir(event);
            if(event.ReturnValue == 0) {
                fs.readFile(job.options.output, 'utf8', function (err,data) {
                    console.log(data);
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
};

