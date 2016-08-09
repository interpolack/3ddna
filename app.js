// import npm modules
var express = require('express')
var app = express()
var stylus = require('stylus')
var multer = require('multer')
var upload = multer({dest: 'public/uploads/'})

// compile .styl files into .css with stylus
function compile(str, path) {
  return stylus(str).set('filename', path)
}
app.use(stylus.middleware({
  src: __dirname + '/public',
  compile: compile,
}))

// specify the location of the .html (.jade) templates
app.set('views', __dirname + '/views')
app.set('view engine', 'jade')

// specify the location of public files
app.use(express.static(__dirname + '/public'))

// render index.jade when user requests /
app.get('/', function(req, res) {
  res.render('index')
})

// render interface.jade when user requests /interface
app.get('/interface', function(req, res) {
  var coordinatesA = app.get('coordinatesA')
  var coordinatesB = app.get('coordinatesB')
  var coordinatesC = app.get('coordinatesC')
  var coordinatesD = app.get('coordinatesD')
  var external = app.get('external')
  var genes = app.get('genes')
  // pass all imported data to interface.jade (see line 38 there)
  res.render('interface', {data: JSON.stringify({
    'coordinatesA': coordinatesA,
    'coordinatesB': coordinatesB,
    'coordinatesC': coordinatesC,
    'coordinatesD': coordinatesD,
    'external': external,
    'genes': genes,
  })})
})

// redirect to interface.jade when user imports data at index.jade
app.post('/load3D', upload.any(), function(req, res) {
  // keep track of where the imported files are located
  req.files.map(function(file, i) {
    app.set(file.fieldname, file.filename)
  })
  res.redirect('/interface')
  res.status(204).end()
})

// listen on port 5000 for connections
app.listen(5000, function() {
  console.log('listening on port 5000')
})
