var rainbow = d3.scale.category20(),

    resolution = '1Mb',
    cgSize = 300,
    graphCap = 1000,
    mapCap,

    graph = {},
    linear = {},
    width = window.innerWidth,
    initialWidth = window.innerWidth,
    height = window.innerHeight,
    initialHeight = window.innerHeight,
    windowRatio = 0.4,

    all = [],
    genomes = [],
    pdb = [],
    segments = [],
    rap = [],
    chromosomes = [],
    meshes = [],
    bufferGeometry = [],
    loaded = {},

    pinned = 0,
    navigation = [],
    navigated = 0,

    alphabet = ['A', 'B', 'C', 'D'],

    scene,
    camera,
    renderer,
    controls,
    genome,
    sphere,
    raycaster = new THREE.Raycaster(),
    mouse = new THREE.Vector2(),
    click = new THREE.Vector2(),
    shifting = false,
    dragging = false,

    zoomToBin = 8,
    graphed = false,
    launch = true

var zoom = d3.behavior.zoom()
  .scaleExtent([1, 20])
  .on('zoom', zoomed)

loadPDB('1Mb')

function loadPDB(resolution) {
  all = []
  genomes = []
  pdb = []
  segments = []
  chromosomes = []

  var q = queue(1)
  q.defer(d3.text, 'uploads/' + data.coordinatesA)
  if (data.coordinatesB != null) q.defer(d3.text, 'uploads/' + data.coordinatesB)
  if (data.coordinatesC != null) q.defer(d3.text, 'uploads/' + data.coordinatesC)
  if (data.coordinatesD != null) q.defer(d3.text, 'uploads/' + data.coordinatesD)
  q.awaitAll(function(error, results){
    pdb = results[0].split('\n')
    var chromosome = -1
    var chr = null
    var index = -1
    for (var i = 0; i < pdb.length - 1; i++) {
      var row = pdb[i].split('\t')
      var location = row[1].split(' ')
      if (chr != location[0].substring(3)) {
        chromosome++
        segments.push([index, i - 1])
        chromosomes.push({
          'chromosome': chromosome,
        })
        index = i
        chr = location[0].substring(3)
      }
      all.push({
        'chromosome': chromosome,
        'bin': i,
      })
    }
    segments.shift()
    segments.push([index, i - 1])

    for (var r = 0; r < results.length; r++) {
      pdb = results[r].split('\n')
      var bins = []
      for (var i = 0; i < pdb.length - 1; i++) {
        var row = pdb[i].split('\t')
        bins.push({
          'x': parseFloat(row[2]),
          'y': parseFloat(row[3]),
          'z': parseFloat(row[4]),
        })
      }
      genomes.push({
        'bins': bins,
        'chromosomes': [],
      })
      $('#genomes').prepend("<div class='genome'><div class='graph'></div></div>")
    }

    for (var g = 0; g < genomes.length; g++) {
      var genome = genomes[g]
      for (var i = 0; i < segments.length; i++) {
        var segment = segments[i]
        var x = 0
        var y = 0
        var z = 0
        for (var s = segment[0]; s < segment[1]; s++) {
          x += genome.bins[s].x
          y += genome.bins[s].y
          z += genome.bins[s].z
        }
        var bins = segment[1] - segment[0]
        x /= bins
        y /= bins
        z /= bins
        genome.chromosomes.push({
          'x': x,
          'y': y,
          'z': z,
        })
      }
    }

    if (launch) init()
    graphGenome()
    modelGenome()
  })
}

function init() {
  launch = false

  graph.svg = d3.select('#graph').append('svg')
    .attr('width', width * windowRatio)
    .attr('height', height)
  graph.floor = graph.svg.append('g')
    .call(zoom)
    .on('mousedown.zoom', null)
  graph.floor.append('rect')
    .attr('width', width * windowRatio)
    .attr('height', height)
    .attr('opacity', 0)
  graph.container = graph.svg.append('g')
  graph.layer1 = graph.container.append('g')
  graph.layer2 = graph.container.append('g')
  graph.layer3 = graph.container.append('g')
  graph.layer4 = graph.container.append('g')

  linear.svg = d3.select('#linear').append('svg')
    .attr('width', width * windowRatio)
    .attr('height', 100)

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(75, width / (height - 250) * (1 - windowRatio), 1, 20000)
  scene.add(camera)
  renderer = new THREE.WebGLRenderer()
  renderer.setSize(width * (1 - windowRatio), height - 250)
  if (genomes.length == 1) d3.select('#model')[0][0].appendChild(renderer.domElement)
  controls = new THREE.TrackballControls(camera, renderer.domElement)

  sphere = new THREE.Mesh(new THREE.SphereGeometry(11.5, 30, 30), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.1 }))
  sphere.visible = false
  scene.add(sphere)

  window.addEventListener('resize', onWindowResize, false)
  document.addEventListener('mousemove', onDocumentMouseMove, false)
  document.addEventListener('mousedown', onDocumentMouseDown, false)
  document.addEventListener('mouseup', onDocumentMouseUp, false)
  document.addEventListener('keyup', onDocumentKeyUp, false)
  document.addEventListener('keydown', onDocumentKeyDown, false)

  var threshold = 35
  navigation.push({
    'context': 'genome',
    'node': 'chromosome',
    'link': 'and',
    'locus': new THREE.Vector3(0, 0, 0),
    'threshold': threshold,
  })

  $('#navigation').on('click', '.nav', function(){
    navigate($('#navigation>.nav').index(this))
  })

  $('#unpin').on('click', function() {
    var nodes = navigation[navigated].context == 'genome' ? graph.genome.nodes : graph.chromosomes.nodes
    for (var i = 0; i < nodes.length; i++) chromosomes[nodes[i].chromosome].pinned = nodes[i].pinned = false
    pinned = 0
    d3.selectAll('.node').attr('opacity', 1)
    linear.svg.selectAll('.active').filter('.highlight').remove()
    alphaModel(0.8, navigation[navigated].chromosomes)
    $(this).css('visibility', 'hidden')
    $('#lookup').css('visibility', 'hidden')
  })

  $('#wireframe').on('click', function() {
    sphere.visible = !sphere.visible
    $(this).css('color', sphere.visible ? '#fff' : '#666')
  })

  $('#threshold').val(threshold)
  $('#threshold').on('input', function(event) {
    var threshold = $(this).val()
    navigation[navigated].threshold = threshold
    var g = graph[navigation[navigated].context]
    var build = navigation[navigated].context == 'genome' ? linkGenome(g.nodes) : linkChromosomes(g.nodes)
    g.force.nodes(build[0]).links(build[1]).start()
    bakeForce(g.force, build[1].length)
  })

  animate()

}

function navigate(nav) {
  $('#navigation>.nav').addClass('inactive')
  $('#navigation>.nav:eq(' + nav + ')').removeClass('inactive')

  $('#threshold').val(navigation[nav].threshold)
  controls.target.copy(navigation[nav].locus)
  camera.position.copy(navigation[nav].locus)
  camera.position.setZ(20)
  graph.container.attr('transform', 'scale(1)')

  if (navigation[nav].context == 'genome') {
    graphGenome()
    alphaModel(0.8)
    linear.svg.selectAll('.chromosome').remove()
    $('#unpin').css('visibility', 'hidden')
  } else if (navigation[nav].context == 'chromosomes') {
    if (navigation[navigated].chromosomes != navigation[nav].chromosomes) graphChromosomes(navigation[nav].chromosomes)
    d3.selectAll('.node').attr('opacity', 1)
    alphaModel(0.8, navigation[nav].chromosomes)
    $('#unpin').css('visibility', 'hidden')
  } else if (navigation[nav].context == 'bins') {
    if (navigation[navigated].chromosomes != navigation[nav].chromosomes) graphChromosomes(navigation[nav].chromosomes)
    for (var i = 0; i < navigation[nav].nodes.length; i++) {
      graph.chromosomes.nodes[navigation[nav].nodes[i]].pinned = true
      pinned++
    }
    d3.selectAll('.node').attr('opacity', function(d){ return d.pinned ? 1 : 0.3 })
    alphaModel(0.8, navigation[nav].chromosomes)
    alphaModelFromGraph()
    $('#unpin').css('visibility', 'visible')
  }

  $('#node').val(navigation[nav].node)
  $('#link').val(navigation[nav].link)

  navigated = nav
}

function search(query) {
  $('#search').val("")
  // TODO: pinned-specific search?
  if (!loaded[query]) return alert("search not found")

  if (navigation[navigated].context == 'genome') {
    var nodes = graph.genome.nodes
    for (var i = 0; i < chromosomes.length; i++) {
      var segment = segments[i]
      chromosomes[i].found = 0
      for (var j = segment[0]; j < segment[1]; j++) {
        chromosomes[i].found += all[j][query]
      }
      chromosomes[i].found /= (segment[1] - segment[0])
    }
    max = 0
    for (var i = 0; i < chromosomes.length; i++) {
      if (chromosomes[i].found > max) max = chromosomes[i].found
    }
    graph.svg.selectAll('.node').attr('opacity', function(d){ return atLeast(d.found / max, 0.2) })
    for (var i = 0; i < chromosomes.length; i++) {
      var alphas = new Float32Array(bufferGeometry[i].attributes.alpha.count)
      for (var a = 0; a < bufferGeometry[i].attributes.alpha.count; a++) alphas[a] = atLeast(chromosomes[i].found / max, 0.2)
      bufferGeometry[i].attributes.alpha = new THREE.BufferAttribute(alphas, 1)
    }
  } else if (navigation[navigated].context == 'chromosomes') {
    var nodes = graph.chromosomes.nodes
    max = 0
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].found = all[nodes[i].bin][query]
      if (nodes[i].found > max) max = nodes[i].found
    }
    graph.svg.selectAll('.node').attr('opacity', function(d){ return atLeast(d.found / max, 0.3) })
    alphaModelFromGraph(max)
  }
}

function modelGenome() {

  scene.remove(genome)
  genome = new THREE.Object3D()
  meshes = []

  for (var i = 0; i < segments.length; i++) {
    var segment = segments[i]
    var curve = new THREE.CatmullRomCurve3(
      genomes[0].bins.slice(segment[0], segment[1]).map(function(values, bin){
        return new THREE.Vector3(values.x, values.y, values.z)
      })
    )

    var geometry = new THREE.TubeGeometry(
      curve,  //path
      (segments[i % segments.length][1] - segments[i % segments.length][0]) * (resolution == '1Mb' ? 5 : 2),    //segments
      resolution == '1Mb' ? 0.05 : 0.1,     //radius
      3,     //radiusSegments
      false  //closed
    )
    bufferGeometry[i] = new THREE.BufferGeometry().fromGeometry(geometry)
    var alphas = new Float32Array(bufferGeometry[i].attributes.position.count)
    var colors = new Float32Array(bufferGeometry[i].attributes.position.count * 3)
    var color = d3.rgb(rainbow(i))
    for (var v = 0; v < bufferGeometry[i].attributes.position.count; v++) {
      alphas[v] = 0.8
      colors[(v * 3)] = color.r / 255
      colors[(v * 3) + 1] = color.g / 255
      colors[(v * 3) + 2] = color.b / 255
    }
    bufferGeometry[i].attributes.alpha = new THREE.BufferAttribute(alphas, 1)
    bufferGeometry[i].attributes.color = new THREE.BufferAttribute(colors, 3)
    material = new THREE.ShaderMaterial({
      vertexShader: document.getElementById('vertexShader').textContent,
      fragmentShader: document.getElementById('fragmentShader').textContent,
      vertexColors: THREE.VertexColors,
      transparent: true,
    })
    meshes[i] = new THREE.Mesh(bufferGeometry[i], material)
    meshes[i].name = i
    genome.add(meshes[i])
  }
  scene.add(genome)

  camera.position.z = resolution == '1Mb' ? 20 : 40

}

function linkGenome(nodes) {
  graph.svg.selectAll('.link').remove()
  var threshold = $('#threshold').val()
  var links = []
  var linked = {}
  for (var i = 0; i < chromosomes.length; i++) {
    var chromosome = nodes[i]
    for (var j = 0; j < chromosomes.length; j++) {
      if (i == j) continue
      var distances = []
      var sum = 0
      var passed = true
      for (var g = 0; g < genomes.length; g++) {
        var distance = distanceToSquared(genomes[g].chromosomes[i].x, genomes[g].chromosomes[i].y, genomes[g].chromosomes[i].z, genomes[g].chromosomes[j].x, genomes[g].chromosomes[j].y, genomes[g].chromosomes[j].z)
        distances.push(distance)
        sum += distance
        if (distance > threshold * genomes.length) passed = false
      }
      sum /= genomes.length
      if (passed && linked[j] == null) {
        links.push({
          'source': i,
          'target': j,
          'distance': sum,
        })
        linked[i] = true
      }
    }
  }

  graph.layer3.selectAll('.link')
    .data(links).enter().append('line')
    .attr('stroke-width', 2)
    .attr('stroke', '#555')
    .attr('opacity', 1)
    .attr('class', 'link interchromosomal')

  return [nodes, links]
}

function graphGenome() {
  graph.svg.selectAll('.node,.link').remove()
  pinned = 0
  for (var i = 0; i < chromosomes.length; i++) chromosomes[i].pinned = false

  var gg = graph.genome = {}
  gg.force = d3.layout.force()
    .size([width * windowRatio, height])
    .charge(-150)
    .linkStrength(function(d){ return Math.sqrt(d.distance) / 5 })
  var build = linkGenome(JSON.parse(JSON.stringify(chromosomes)))
  gg.nodes = build[0]
  gg.links = build[1]

  var node = graph.layer4.selectAll('.node')
    .data(gg.nodes)
  var nodeEnter = node.enter().append('g')
    .filter(function(d){ return !d.double })
    .attr('class', 'node chromosome')
  nodeEnter.append('circle')
    .attr('r', 8)
    .attr('stroke', '#333')
    .attr('stroke-width', 3)
    .attr('fill', function(d,i){ return rainbow(i) })
  nodeEnter.append('text')
    .text(function(d,i){ return chromosomeName(i) })
    .attr('fill', '#333')
    .attr('font-size', '8px')
    .attr('y', 3)
    .attr('text-anchor', 'middle')
    .attr('font-weight', 700)
  nodeEnter.on('mouseover', function(d){
    if (pinned == 0) d3.selectAll('.chromosome').attr('opacity', 0.2)
    else d3.selectAll('.chromosome').attr('opacity', function(d,i){ return d.pinned ? 1 : 0.2 })
    d3.select(this).attr('opacity', 1)
    for (var i = 0; i < segments.length; i++) {
      var alphas = new Float32Array(bufferGeometry[i].attributes.alpha.count)
      if (i == d.chromosome || chromosomes[i].pinned) for (var a = 0; a < bufferGeometry[i].attributes.alpha.count; a++) alphas[a] = 0.8
      else for (var a = 0; a < bufferGeometry[i].attributes.alpha.count; a++) alphas[a] = 0.2
      bufferGeometry[i].attributes.alpha = new THREE.BufferAttribute(alphas, 1)
    }
    if (!d.pinned) linear.svg.append('rect')
      .attr('fill', rainbow(d.chromosome))
      .attr('rx', 3)
      .attr('x', 20 + (segments[d.chromosome][0]) * linear.ratio)
      .attr('y', 70)
      .attr('width', atLeast((segments[d.chromosome][1] - segments[d.chromosome][0]) * linear.ratio, 10))
      .attr('height', 10)
      .attr('class', 'active highlight chr' + d.chromosome + '-all')
  })
  nodeEnter.on('mouseout', function(d){
    if (pinned == 0) d3.selectAll('.chromosome').attr('opacity', 1)
    else d3.selectAll('.chromosome').attr('opacity', function(d,i){ return d.pinned ? 1 : 0.2 })
    for (var i = 0; i < segments.length; i++) {
      var alphas = new Float32Array(bufferGeometry[i].attributes.alpha.count)
      if (pinned == 0 || chromosomes[i].pinned) for (var a = 0; a < bufferGeometry[i].attributes.alpha.count; a++) alphas[a] = 0.8
      else for (var a = 0; a < bufferGeometry[i].attributes.alpha.count; a++) alphas[a] = 0.2
      bufferGeometry[i].attributes.alpha = new THREE.BufferAttribute(alphas, 1)
    }
    linear.svg.selectAll('.chr' + d.chromosome + '-all').filter(function(o){ return !d3.select(this).classed('pinned') }).remove()
  })
  nodeEnter.on('click', function(d){
    d.pinned = !d.pinned
    if (d.pinned) pinned++
    else pinned--
    chromosomes[d.chromosome] = d
    linear.svg.selectAll('.chr' + d.chromosome + '-all').classed('pinned', d.pinned)
    $('#unpin').css('visibility', pinned == 0 ? 'hidden' : 'visible')
  })

  graph.context = makeAbsoluteContext(graph.layer4[0][0], graph.svg[0][0])

  gg.force.nodes(gg.nodes).links(gg.links)
  bakeForce(gg.force, gg.links.length * 2)

  linear.svg.line = linear.svg.append('rect')
    .attr('rx', 3)
    .attr('width', (width * windowRatio) - 50)
    .attr('height', 10)
    .attr('x', 20)
    .attr('y', 70)
    .attr('fill', '#222')

  linear.ratio = 1 / segments[segments.length - 1][1] * ((width * windowRatio) - 50)
  linear.lit = {}
}

function bakeForce(force, iterations) {
  force.start()
  for (var i = 0; i < iterations; i++) force.tick()
  force.stop()
  graph.svg.selectAll('.node')
    .attr('transform', function(d,i){ return 'translate(' + d.x + ',' + d.y + ')'})
  graph.svg.selectAll('.link')
    .attr('x1', function(d){ return d.source.x })
    .attr('y1', function(d){ return d.source.y })
    .attr('x2', function(d){ return d.target.x })
    .attr('y2', function(d){ return d.target.y })
}

function linkChromosomes(nodes) {
  graph.svg.selectAll('.link,.shadow').remove()
  if (nodes.length > graph.chromosomes.bins) nodes = nodes.slice(0, graph.chromosomes.bins)
  var threshold = $('#threshold').val()
  var links = []
  var linked = {}
  var doubled = {}
  for (var i = 0; i < graph.chromosomes.bins; i++) {
    nodes[i].pinned = false
    var bin = nodes[i]
    for (var j = 0; j < graph.chromosomes.bins; j++) {
      if (i == j) continue
      var con = nodes[j].bin
      var distances = []
      var sum = 0
      var passed = true
      for (var g = 0; g < genomes.length; g++) {
        var distance = distanceToSquared(genomes[g].bins[bin.bin].x, genomes[g].bins[bin.bin].y, genomes[g].bins[bin.bin].z, genomes[g].bins[nodes[j].bin].x, genomes[g].bins[nodes[j].bin].y, genomes[g].bins[nodes[j].bin].z)
        distances.push(distance)
        sum += distance
        if (distance > threshold / 10 * genomes.length) passed = false
      }
      sum /= genomes.length
      if (passed && linked[con] == null) {
        links.push({
          'source': i,
          'target': j,
          'distance': sum,
          'physical': Math.abs(j - i) == 1 && nodes[i].chromosome == nodes[j].chromosome ? nodes[i].chromosome : -1
        })
        linked[bin.bin] = true
      }
    }
  }

  graph.layer3.selectAll('.link')
    .data(links).enter().append('line')
    .attr('stroke-width', 1)
    .attr('stroke', function(d){ return d.physical >= 0 ? rainbow(d.physical) : '#fff' })
    .attr('opacity', function(d){ return d.physical >= 0 ? 1 : 0.1 })
    .attr('class', 'link interbin')

  return [nodes, links]
}

function graphChromosomes(chr) {
  graph.svg.selectAll('.node,.link,.chromosome').remove()
  pinned = 0
  for (var i = 0; i < chromosomes.length; i++) chromosomes[i].pinned = false

  linear.svg.selectAll('.highlight').attr('fill', '#444').classed('active', false)

  graphed = true
  var cg = graph.chromosomes = {}
  cg.force = d3.layout.force()
    .size([width * windowRatio, height])
    .linkDistance(function(d){ return d.distance * 3 })
    .linkStrength(function(d){ return d.affinity >= 1 ? 0 : 0.3 })
    .charge(-30)
  cg.nodes = []
  cg.nodesDict = {}
  cg.chr = chr

  for (var i = 0; i < chr.length; i++) {
    var segment = segments[chr[i]]
    for (var j = segment[0]; j < segment[1]; j++) {
      cg.nodes.push(all[j])
      cg.nodesDict[chr[i] + ':' + (j - segment[0])] = cg.nodes.length - 1
    }
  }

  cg.bins = cg.nodes.length
  cg.links = linkChromosomes(cg.nodes)[1]

  var node = graph.layer4.selectAll('.node')
    .data(cg.nodes)
  var nodeEnter = node.enter().append('g')
    .filter(function(d){ return !d.double })
    .attr('class', 'node bin')
    .attr('opacity', function(d){ return (pinned == 0 || d.pinned) ? 1 : 0.2 })
  nodeEnter.append('circle')
    .attr('r', 3)
    .attr('stroke', '#333')
    .attr('stroke-width', 2)
    .attr('fill', function(d){ return rainbow(d.chromosome) })
  nodeEnter.on('mouseover', function(d){
    if (pinned == 0) d3.selectAll('.node').attr('opacity', 0.2)
    else d3.selectAll('.node').attr('opacity', function(d,i){ return d.pinned ? 1 : 0.2 })
    d3.select(this).attr('opacity', 1)
    for (var i = 0; i < chr.length; i++) {
      var segment = segments[chr[i]]
      var geometry = bufferGeometry[chr[i]]
      var mesh = meshes[chr[i]]
      var total = geometry.attributes.alpha.count
      var bins = segment[1] - segment[0]
      var size = parseInt(total / bins)
      for (var j = segment[0]; j < segment[1]; j++) {
        if (j == d.bin || all[j].pinned) for (var k = (j - segment[0]) * size; k < (j + 1 - segment[0]) * size; k++) geometry.attributes.alpha.array[k] = 0.8
        else for (var k = (j - segment[0]) * size; k < (j + 1 - segment[0]) * size; k++) geometry.attributes.alpha.array[k] = 0.2
      }
      geometry.attributes.alpha.needsUpdate = true
    }
    if (!d.pinned) {
      linear.svg.append('line')
        .attr('stroke', rainbow(d.chromosome))
        .attr('x1', 20 + d.bin * linear.ratio)
        .attr('x2', 20 + d.bin * linear.ratio)
        .attr('y1', 70 + 0)
        .attr('y2', 70 + 10)
        .attr('class', 'active highlight chr' + d.chromosome + '-' + d.bin)
      var ratio = 1 / (segments[0][1] - segments[0][0]) * ((width * windowRatio) - 70)
      linear.svg.chromosomes[d.chromosome].append('line')
        .attr('stroke', rainbow(d.chromosome))
        .attr('x1', 15 + 20 + (d.bin - segments[d.chromosome][0]) * ratio)
        .attr('x2', 15 + 20 + (d.bin - segments[d.chromosome][0]) * ratio)
        .attr('y1', 0)
        .attr('y2', 10)
        .attr('class', 'active highlight chr' + d.chromosome + '-' + d.bin)
    }
  })
  nodeEnter.on('mouseout', function(d){
    if (pinned == 0) d3.selectAll('.node').attr('opacity', 1)
    else d3.selectAll('.node').attr('opacity', function(d,i){ return d.pinned ? 1 : 0.2 })
    for (var i = 0; i < chr.length; i++) {
      var segment = segments[chr[i]]
      var geometry = bufferGeometry[chr[i]]
      var mesh = meshes[chr[i]]
      var total = geometry.attributes.alpha.count
      var bins = segment[1] - segment[0]
      var size = parseInt(total / bins)
      for (var j = segment[0]; j < segment[1]; j++) {
        if (pinned == 0 || all[j].pinned) for (var k = (j - segment[0]) * size; k < (j + 1 - segment[0]) * size; k++) geometry.attributes.alpha.array[k] = 0.8
        else for (var k = (j - segment[0]) * size; k < (j + 1 - segment[0]) * size; k++) geometry.attributes.alpha.array[k] = 0.2
      }
      geometry.attributes.alpha.needsUpdate = true
    }
    linear.svg.selectAll('.chr' + d.chromosome + '-' + d.bin).filter(function(o){ return !d3.select(this).classed('pinned') }).remove()
  })
  nodeEnter.on('click', function(d){
    d.pinned = !d.pinned
    if (d.pinned) pinned++
    else pinned--
    all[d.bin] = d
    linear.svg.selectAll('.chr' + d.chromosome + '-' + d.bin).classed('pinned', d.pinned)
    $('#unpin').css('visibility', pinned == 0 ? 'hidden' : 'visible')
  })

  cg.force.nodes(cg.nodes).links(cg.links).start()
  bakeForce(cg.force, cg.links.length)

  linear.svg.chromosomes = {}
  var longest = segments[0][1] - segments[0][0]
  for (var i = 0; i < chr.length; i++) {
    var c = chr[i]
    var chromosome = linear.svg.append('g')
      .attr('transform', 'translate(0,' + (70 - ((i + 1) * 15)) + ')')
      .attr('class', 'chromosome')
      .on('mouseleave', function(){
        linear.svg.chromosomes[c].selectAll('.box').remove()
      })
      .on('mouseenter', function(){
        var highlighted = []
        var nodes = graph.chromosomes.nodes
        var i = 0
        var start = null
        while (i < nodes.length - 1) {
          if (start == null && nodes[i].pinned && nodes[i + 1].pinned) start = i
          else if (start != null && nodes[i].pinned && !nodes[i + 1].pinned) {
            highlighted.push([start, i])
            start = null
          }
          i++
        }
        if (start != null) highlighted.push([start, i])
        var ratio = 1 / (segments[0][1] - segments[0][0]) * ((width * windowRatio) - 70)
        linear.svg.chromosomes[c].selectAll('.box')
          .data(highlighted).enter().append('rect')
          .attr('class', 'box')
          .attr('cursor', 'pointer')
          .attr('stroke', '#fff')
          .attr('fill', 'transparent')
          .attr('rx', 2)
          .attr('x', function(d){
            var nodeA = nodes[d[0]]
            var start = 15 + 20 + (nodeA.bin - segments[nodeA.chromosome][0]) * ratio
            return start
          })
          .attr('height', 10)
          .attr('width', function(d){
            var nodeA = nodes[d[0]]
            var nodeB = nodes[d[1]]
            var start = 15 + 20 + (nodeA.bin - segments[nodeA.chromosome][0]) * ratio
            var end = 15 + 20 + (nodeB.bin - segments[nodeB.chromosome][0]) * ratio
            return end - start
          })
          .on('click', function(d){
            lookup(c, d)
          })
      })
    chromosome.append('rect')
      .attr('rx', 3)
      .attr('width', 10)
      .attr('height', 10)
      .attr('x', 20)
      .attr('y', 0)
      .attr('fill', rainbow(c))
      .attr('cursor', 'pointer')
      // .on('click', function(){ lookup(c) })
    chromosome.append('text')
      .text(chromosomeName(c))
      .attr('fill', '#333')
      .attr('font-size', 6)
      .attr('x', 25)
      .attr('y', 7.5)
      .attr('text-anchor', 'middle')
      .attr('pointer-events', 'none')
      .attr('font-weight', 500)
    chromosome.append('rect')
      .attr('rx', 3)
      .attr('width', (segments[c][1] - segments[c][0]) / longest * ((width * windowRatio) - 70))
      .attr('height', 10)
      .attr('x', 35)
      .attr('fill', '#222')
    linear.svg.chromosomes[c] = chromosome
  }
}

function animate() {
  requestAnimationFrame(animate)
  controls.update()
  render()
}

function render() {
  renderer.render(scene, camera)
}
