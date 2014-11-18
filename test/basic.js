var osg = require('../index');

var workflow = new osg.Workflow();
describe('workflow', function() {
    it('should submit a job', function(done) {
        var job = workflow.submit({
            executable: '/bin/hostname',
            debug: true
        }); 
        job.on('submit', function(info) {
            done();
            job.remove();
        });
    });

    /*
    it('should transfer an input file', function(done) {
        this.timeout(60*1000);//too short?
        var job = workflow.submit({
            executable: '/bin/cat',
            arguments: 'issue',
            send: '/etc/issue'
        });
        job.on('terminate', function(info) {
            console.dir(info);
        });
    });
    */
    /*
    it('should a job timeout', function(done) {
        this.timeout(10*1000); 
        var job = workflow.submit({
            executable: '/bin/sleep',
            argument: '10', //make job to run for 10 seconds..
            timeout: 5*1000 //timeout in 5 seconds (including idle item..)
        }); 
        job.on('submit', function(info) {
            console.log("submitted:"+info.id);
            console.dir(info.props.PeriodicHold);
        });
        job.on('hold', function(info) {
            done();
            job.remove();
        });
        job.on('terminated', function(info) {
            console.dir(info);
        });
    });
    */
});