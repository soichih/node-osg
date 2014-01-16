var fs = require('fs');
var XML = require('xml-simple');

fs.readFile('test.xml', {encoding: 'utf8'}, function (err, data) {
    if (err) throw err;
    console.log(data);
    XML.parse(data, function(err, attrs) {
        console.dir(attrs);
    });
});
