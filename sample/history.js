var osg = require('../index.js');

var workflow = new osg.Workflow();
var job = workflow.submit({
    executable: 'test.sh', //executable to send & run (usually a shell script)
});
job.on('submit', function(info) {
    console.log("job submitted");
});
job.on('hold', function(info) {
    console.log("job held");
    console.dir(info);
});
job.on('terminate', function(info) {
    console.log("job terminated");
    setTimeout(function() {
        console.log("looking up history");
        job.history(function(err, info) {
            console.dir(info);
        });
    }, 2000);
});
