var express = require('express')
var app = express()
var stylus = require('stylus')
var multer = require('multer')
var upload = multer({dest: 'public/uploads/'})

function compile(str, path) {
  return stylus(str).set('filename', path)
}
app.set('views', __dirname + '/views')
app.set('view engine', 'jade')
app.use(stylus.middleware({
  src: __dirname + '/public',
  compile: compile,
}))
app.use(express.static(__dirname + '/public'))

app.get('/', function(req, res) {
  res.render('index')
})

app.get('/interface', function(req, res) {
  var coordinatesA = app.get('coordinatesA')
  var coordinatesB = app.get('coordinatesB')
  var coordinatesC = app.get('coordinatesC')
  var coordinatesD = app.get('coordinatesD')
  var external = app.get('external')
  res.render('interface', {data: JSON.stringify({
    'coordinatesA': coordinatesA,
    'coordinatesB': coordinatesB,
    'coordinatesC': coordinatesC,
    'coordinatesD': coordinatesD,
    'external': external,
  })})
})

app.post('/load3D', upload.any(), function(req, res) {
  req.files.map(function(file, i) {
    app.set(file.fieldname, file.filename)
  })
  res.redirect('/interface')
  res.status(204).end()
})

app.listen(5000, function() {
  console.log('listening on port 5000')
})
