'use strict'

var rainbow = d3.scale.category20(),

    resolution = '1Mb',
    threshold,
    build,

    graph = {},
    linear = {},
    width = window.innerWidth,
    initialWidth = window.innerWidth,
    height = window.innerHeight,
    initialHeight = window.innerHeight,
    windowRatio = 0.3,
    subWidth,

    all = [],
    genomes = [],
    pdb = [],
    segments = [],
    rap = [],
    chromosomes = [],
    bufferGeometry = [],
    loaded = {},

    pinned = 0,
    navigation = [],
    navigated = 0,

    alphabet = ['A', 'B', 'C', 'D'],

    scenes = {},
    cameras = {},
    renderers = {},
    controls = {},
    models = {},
    geometries = {},
    meshes = {},
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
      $('#genomes').append(
        "<div class='genome' id='genome" + r + "'><div class='title'>STRUCT <b>" + alphabet[r]
        + "</b><br><div class='info'>Type: Mouse Sim<br>Author: Noah</div></div><svg class='graph' id='graph"
        + r + "'></svg><div class='model' id='model"
        + r + "'></div><svg class='matrix' id='matrix"
        + r + "'></svg</div>"
      )
      $('.main').append(" <b>" + alphabet[r] + "</b>")
      if (r < results.length - 1) $('.main').append(" &and;")
    }
    subWidth = height / genomes.length
    $('.genome')
      .css('height', subWidth)
      .css('width', subWidth * 3)
    if (genomes.length == 1) d3.selectAll('.graph').remove()
    else d3.selectAll('.graph,.matrix')
      .style('width', subWidth - 50)
      .style('height', subWidth - 50)

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


  for (var g = 0; g < genomes.length; g++) {
    scenes[g] = new THREE.Scene()
    cameras[g] = new THREE.PerspectiveCamera(75, 1, 1, 20000)
    renderers[g] = new THREE.WebGLRenderer({ alpha: true })
    renderers[g].setSize(subWidth - 50, subWidth - 50)
    renderers[g].setClearColor(0x000000, 0)
    $('#genome' + g + ' .model').append(renderers[g].domElement)
    controls[g] = new THREE.TrackballControls(cameras[g], renderers[g].domElement)
    sphere = new THREE.Mesh(new THREE.SphereGeometry(11.5, 30, 30), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.1 }))
    sphere.visible = false
    scenes[g].add(cameras[g])
    scenes[g].add(sphere)
  }

  window.addEventListener('resize', onWindowResize, false)
  document.addEventListener('mousemove', onDocumentMouseMove, false)
  document.addEventListener('mousedown', onDocumentMouseDown, false)
  document.addEventListener('mouseup', onDocumentMouseUp, false)
  document.addEventListener('keyup', onDocumentKeyUp, false)
  document.addEventListener('keydown', onDocumentKeyDown, false)

  threshold = 35
  navigation.push({
    'context': 'genome',
    'node': 'chromosome',
    'link': 'and',
    'loci': genomes.map(function(d){ return new THREE.Vector3(0, 0, 0) }),
    'threshold': threshold,
  })

  $('#navigation').on('click', '.nav', function(){
    navigate($('#navigation>.nav').index(this))
  })

  $('#unpin').on('click', function() {
    if (navigation[navigated].context == 'bins') navigate(navigation[navigated].root)
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
    threshold = parseInt($(this).val())
    navigation[navigated].threshold = threshold
    threshold /= navigation[navigated].context == 'genome' ? 1 : 5
    var g = graph[navigation[navigated].context]
    build = navigation[navigated].context == 'genome' ? linkGenome(g.nodes) : linkChromosomes(g.nodes)
    g.force.nodes(build[0]).links(build[1]).start()
    bakeForce(g.force, build[1].length)
    g = null
  })
  $('#threshold').on('mouseup', function(event) {
    mapGraphs(build[0], build[2])
  })

  animate()

}

function navigate(nav) {
  $('#navigation>.nav').addClass('inactive')
  $('#navigation>.nav:eq(' + nav + ')').removeClass('inactive')

  $('#threshold').val(navigation[nav].threshold)
  threshold = navigation[nav].threshold
  threshold /= navigation[nav].context == 'genome' ? 1 : 5

  for (var g = 0; g < genomes.length; g++) {
    controls[g].target.copy(navigation[nav].loci[g])
    cameras[g].position.copy(navigation[nav].loci[g])
    if (navigation[nav].context == 'genome') cameras[g].position.set(11, 11, 11)
    else cameras[g].position.copy(navigation[nav].loci[g].sub(new THREE.Vector3(8, 8, 8)))
  }
  graph.container.attr('transform', 'scale(1)')

  if (navigation[nav].context == 'genome') {
    graphGenome()
    alphaModel(0.8)
    linear.svg.selectAll('.chromosome').remove()
    $('#unpin').css('visibility', 'hidden')
  } else if (navigation[nav].context == 'chromosomes') {
    if (navigation[navigated].chromosomes != navigation[nav].chromosomes) graphChromosomes(navigation[nav].chromosomes)
    else mapGraphs(graph.chromosomes.nodes, graph.chromosomes.others)
    d3.selectAll('.node').attr('opacity', 1)
    alphaModel(0.8, navigation[nav].chromosomes)
    $('#unpin').css('visibility', 'hidden')
  } else if (navigation[nav].context == 'bins') {
    var keep = []
    if (navigation[navigated].chromosomes != navigation[nav].chromosomes) graphChromosomes(navigation[nav].chromosomes)
    for (var i = 0; i < navigation[nav].nodes.length; i++) {
      keep.push(navigation[nav].nodes[i])
      graph.chromosomes.nodes[navigation[nav].nodes[i]].pinned = true
      pinned++
    }
    d3.selectAll('.node').attr('opacity', function(d){ return d.pinned ? 1 : 0.3 })
    alphaModel(0.8, navigation[nav].chromosomes)
    alphaModelFromGraph()
    $('#unpin').css('visibility', 'visible')
    mapGraphs(graph.chromosomes.nodes, graph.chromosomes.others, keep)
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
    for (var g = 0; g < genomes.length; g++) {
      for (var i = 0; i < chromosomes.length; i++) {
        var alphas = new Float32Array(geometries[g][i].attributes.alpha.count)
        for (var a = 0; a < geometries[g][i].attributes.alpha.count; a++) alphas[a] = atLeast(chromosomes[i].found / max, 0.2)
        geometries[g][i].attributes.alpha = new THREE.BufferAttribute(alphas, 1)
      }
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

  for (var g = 0; g < genomes.length; g++) {
    scenes[g].remove(models[g])
    models[g] = new THREE.Object3D()

    meshes[g] = []
    geometries[g] = []

    for (var i = 0; i < segments.length; i++) {
      var segment = segments[i]
      var curve = new THREE.CatmullRomCurve3(
        genomes[g].bins.slice(segment[0], segment[1]).map(function(values, bin){
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

      geometries[g][i] = new THREE.BufferGeometry().fromGeometry(geometry)
      var alphas = new Float32Array(geometries[g][i].attributes.position.count)
      var colors = new Float32Array(geometries[g][i].attributes.position.count * 3)
      var color = d3.rgb(rainbow(i))
      for (var v = 0; v < geometries[g][i].attributes.position.count; v++) {
        alphas[v] = 0.8
        colors[(v * 3)] = color.r / 255
        colors[(v * 3) + 1] = color.g / 255
        colors[(v * 3) + 2] = color.b / 255
      }
      geometries[g][i].attributes.alpha = new THREE.BufferAttribute(alphas, 1)
      geometries[g][i].attributes.color = new THREE.BufferAttribute(colors, 3)
      var material = new THREE.ShaderMaterial({
        vertexShader: document.getElementById('vertexShader').textContent,
        fragmentShader: document.getElementById('fragmentShader').textContent,
        vertexColors: THREE.VertexColors,
        transparent: true,
      })
      meshes[g][i] = new THREE.Mesh(geometries[g][i], material)
      meshes[g][i].name = i
      models[g].add(meshes[g][i])
    }
    scenes[g].add(models[g])
    cameras[g].position.set(11, 11, 11)
  }

}

function linkGenome(nodes) {
  graph.svg.selectAll('.link').remove()
  var links = []
  var others = []
  var linked = {}
  for (var i = 0; i < chromosomes.length; i++) {
    var chromosome = nodes[i]
    for (var j = 0; j < chromosomes.length; j++) {
      if (i == j) continue
      var passes = []
      var distances = []
      var sum = 0
      var passed = true
      for (var g = 0; g < genomes.length; g++) {
        var distance = distanceToSquared(genomes[g].chromosomes[i].x, genomes[g].chromosomes[i].y, genomes[g].chromosomes[i].z, genomes[g].chromosomes[j].x, genomes[g].chromosomes[j].y, genomes[g].chromosomes[j].z)
        passes.push(distance < threshold)
        distances.push(distance)
        sum += distance
        if (distance > threshold * genomes.length) passed = false
      }
      sum /= genomes.length
      if (linked[j] == null) {
        if (passed) links.push({
          'source': i,
          'target': j,
          'distance': sum,
          'affinity': passes,
          'passed': passed,
        })
        others.push({
          'source': i,
          'target': j,
          'distance': distances,
          'affinity': passes,
          'passed': passed,
        })
        linked[i] = true
      }
    }
  }

  graph.layer3.selectAll('.link')
    .data(links).enter().append('line')
    .filter(function(d){ return d.passed })
    .attr('stroke-width', 2)
    .attr('stroke', '#555')
    .attr('opacity', 1)
    .attr('class', 'link interchromosomal')
    .on('mouseover', function(d){
      for (var g = 0; g < genomes.length; g++) {
        var submatrix = d3.select('#matrix' + g)
        submatrix.append('rect')
          .attr('fill', 'none')
          .attr('stroke', '#fff')
          .attr('class', 'highlight')
          .attr('width', submatrix.attr('size'))
          .attr('height', submatrix.attr('size'))
          .attr('x', 25 + d.source.chromosome * submatrix.attr('size'))
          .attr('y', 25 + d.target.chromosome * submatrix.attr('size'))
        submatrix.append('rect')
          .attr('fill', 'none')
          .attr('stroke', '#fff')
          .attr('class', 'highlight')
          .attr('width', submatrix.attr('size'))
          .attr('height', submatrix.attr('size'))
          .attr('x', 25 + d.target.chromosome * submatrix.attr('size'))
          .attr('y', 25 + d.source.chromosome * submatrix.attr('size'))
      }
    })
    .on('mouseout', function(d){
      d3.selectAll('.highlight').remove()
    })

  return [nodes, links, others]
}

function graphGenome() {
  graph.svg.selectAll('.node,.link').remove()
  pinned = 0
  for (var i = 0; i < chromosomes.length; i++) chromosomes[i].pinned = false

  var gg = graph.genome = {}
  gg.force = d3.layout.force()
    .size([width * windowRatio, height])
    .charge(-150)
    .linkStrength(function(d){ return d.passed ? Math.sqrt(d.distance) / 5 : 0 })
  build = linkGenome(JSON.parse(JSON.stringify(chromosomes)))
  gg.nodes = build[0]
  gg.links = build[1]
  gg.others = build[2]

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
  nodeEnter.on('mouseover', function(d,index){
    if (pinned == 0) d3.selectAll('.node').attr('opacity', 0.2)
    else d3.selectAll('.node').attr('opacity', function(d,i){ return d.pinned ? 1 : 0.2 })
    d3.select(this).attr('opacity', 1)
    d3.selectAll('.node' + d.chromosome).attr('opacity', 1)
    for (var g = 0; g < genomes.length; g++) {
      drawCrosshair(g, index, true)
      for (var i = 0; i < segments.length; i++) {
        var alphas = new Float32Array(geometries[g][i].attributes.alpha.count)
        if (i == d.chromosome || chromosomes[i].pinned) for (var a = 0; a < geometries[g][i].attributes.alpha.count; a++) alphas[a] = 0.8
        else for (var a = 0; a < geometries[g][i].attributes.alpha.count; a++) alphas[a] = 0.2
        geometries[g][i].attributes.alpha = new THREE.BufferAttribute(alphas, 1)
      }
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
    if (pinned == 0) d3.selectAll('.node,.tile').attr('opacity', 1)
    else d3.selectAll('.node').attr('opacity', function(d,i){ return d.pinned ? 1 : 0.2 })
    d3.selectAll('.crosshair').remove()
    for (var g = 0; g < genomes.length; g++) {
      for (var i = 0; i < segments.length; i++) {
        var alphas = new Float32Array(geometries[g][i].attributes.alpha.count)
        if (pinned == 0 || chromosomes[i].pinned) for (var a = 0; a < geometries[g][i].attributes.alpha.count; a++) alphas[a] = 0.8
        else for (var a = 0; a < geometries[g][i].attributes.alpha.count; a++) alphas[a] = 0.2
        geometries[g][i].attributes.alpha = new THREE.BufferAttribute(alphas, 1)
      }
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
  mapGraphs(gg.nodes, gg.others)

  linear.svg.line = linear.svg.append('rect')
    .attr('rx', 3)
    .attr('width', (width * windowRatio) - 50)
    .attr('height', 10)
    .attr('x', 20)
    .attr('y', 70)
    .attr('fill', '#222')

  linear.ratio = 1 / segments[segments.length - 1][1] * ((width * windowRatio) - 50)
  linear.lit = {}

  node = null
  nodeEnter = null

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

/* update the comparison rows:
/ nodes: nodes (bins or chromosomes) from the lefthand side
/ links: links from each of these nodes to all others
/ keep: if not null, do not consider any nodes outside of this array
*/
function mapGraphs(nodes, links, keep) {
  var r = nodes[0].bin == null ? 3 : 2
  var selector = nodes[0].bin == null ? 'chromosome' : 'bin'
  for (var g = 0; g < genomes.length; g++) {
    // update the graphs in each comparison row:
    var subgraph = d3.select('#graph' + g)
    subgraph.selectAll('.node,.link').remove()
    var size = subWidth - 50
    var zoom = 1.5
    subgraph.selectAll('.link')
      .data(links)
      .enter()
      .append('line')
      .filter(function(d){
        if (keep != null && keep.indexOf(d.source) < 0 && keep.indexOf(d.target) < 0) return false
        return d.physical >= 0 || d.distance[g] < threshold
      })
      .attr('x1', function(d){ return ((nodes[d.source].x / width / windowRatio * (size * 0.5) + (size * 0.25)) - (size / 2)) * zoom + (size / 2)  })
      .attr('x2', function(d){ return ((nodes[d.target].x / width / windowRatio * (size * 0.5) + (size * 0.25)) - (size / 2)) * zoom + (size / 2)  })
      .attr('y1', function(d){ return (((nodes[d.source].y - height / 2) / width / windowRatio * (size * 0.5) + (size / 2)) - (size / 2)) * zoom + (size / 2) })
      .attr('y2', function(d){ return (((nodes[d.target].y - height / 2) / width / windowRatio * (size * 0.5) + (size / 2)) - (size / 2)) * zoom + (size / 2) })
      .attr('stroke', function(d){ return d.physical >= 0 ? rainbow(d.physical) : '#fff' })
      .attr('opacity', function(d){ return d.physical >= 0 ? 0.5 : (threshold - d.distance[g]) / threshold / 10 })
      .attr('class', 'link')
    subgraph.selectAll('.node')
      .data(nodes)
      .enter()
      .append('circle')
      .filter(function(d,i){
        if (keep != null && keep.indexOf(i) < 0) return false
        return true
      })
      .attr('r', r)
      .attr('cx', function(d){ return ((d.x / width / windowRatio * (size * 0.5) + (size * 0.25)) - (size / 2)) * zoom + (size / 2) })
      .attr('cy', function(d){ return (((d.y - height / 2) / width / windowRatio * (size * 0.5) + (size / 2)) - (size / 2)) * zoom + (size / 2) })
      .attr('fill', function(d){ return rainbow(d.chromosome) })
      .attr('class', function(d){ return 'node' + ' node' + d[selector] })
    // update the matrices in each comparison row:
    var submatrix = d3.select('#matrix' + g)
    submatrix.selectAll('.tile').remove()
    var tiles = []
    var elements = genomes[g][selector + 's']
    if (keep == null) {
      for (var i = 0; i < nodes.length; i++) {
        for (var j = 0; j < nodes.length; j++) {
          tiles.push({'chromosome': nodes[i].chromosome, 'i': i, 'j': j, 'distance': distanceToSquared(elements[nodes[i][selector]].x, elements[nodes[i][selector]].y, elements[nodes[i][selector]].z, elements[nodes[j][selector]].x, elements[nodes[j][selector]].y, elements[nodes[j][selector]].z) })
        }
      }
    } else {
      for (var i = 0; i < keep.length; i++) {
        for (var j = 0; j < keep.length; j++) {
          tiles.push({'chromosome': nodes[keep[i]].chromosome, 'i': i, 'j': j, 'distance': distanceToSquared(elements[nodes[keep[i]][selector]].x, elements[nodes[keep[i]][selector]].y, elements[nodes[keep[i]][selector]].z, elements[nodes[keep[j]][selector]].x, elements[nodes[keep[j]][selector]].y, elements[nodes[keep[j]][selector]].z) })
        }
      }
    }
    var size = keep == null ? (subWidth - 100) / nodes.length : (subWidth - 100) / keep.length
    submatrix.attr('size', size)
    submatrix.selectAll('.tile')
      .data(tiles)
      .enter()
      .append('rect')
      .attr('width', size)
      .attr('height', size)
      .attr('x', function(d){ return 25 + size * d.i })
      .attr('y', function(d){ return 25 + size * d.j })
      .attr('fill', function(d){
        var color = d3.rgb(rainbow(d.chromosome))
        if (d.distance == 0) return color
        color.r = parseInt(color.r / d.distance * 10 + 1)
        color.g = parseInt(color.g / d.distance * 10 + 1)
        color.b = parseInt(color.b / d.distance * 10 + 1)
        return color
      })
      .attr('class', 'tile')
  }
}

function linkChromosomes(nodes) {
  graph.svg.selectAll('.link,.shadow').remove()
  if (nodes.length > graph.chromosomes.bins) nodes = nodes.slice(0, graph.chromosomes.bins)
  var links = []
  var others = []
  var linked = {}
  var doubled = {}
  for (var i = 0; i < graph.chromosomes.bins; i++) {
    nodes[i].pinned = false
    var bin = nodes[i]
    for (var j = 0; j < graph.chromosomes.bins; j++) {
      if (i == j) continue
      var con = nodes[j].bin
      var passes = []
      var distances = []
      var sum = 0
      var passed = true
      for (var g = 0; g < genomes.length; g++) {
        var distance = distanceToSquared(genomes[g].bins[bin.bin].x, genomes[g].bins[bin.bin].y, genomes[g].bins[bin.bin].z, genomes[g].bins[nodes[j].bin].x, genomes[g].bins[nodes[j].bin].y, genomes[g].bins[nodes[j].bin].z)
        passes.push(distance < threshold)
        distances.push(distance)
        sum += distance
        if (distance > threshold) passed = false
      }
      sum /= genomes.length
      if (linked[con] == null) {
        if (passed) links.push({
          'source': i,
          'target': j,
          'distance': sum,
          'affinity': passes,
          'passed': passed,
          'physical': Math.abs(j - i) == 1 && nodes[i].chromosome == nodes[j].chromosome ? nodes[i].chromosome : -1
        })
        others.push({
          'source': i,
          'target': j,
          'distance': distances,
          'affinity': passes,
          'passed': passed,
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

  return [nodes, links, others]
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
    .linkStrength(function(d){ return d.physical < 0 ? 0.1 : 1 })
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
  build = linkChromosomes(cg.nodes)
  cg.links = build[1]
  cg.others = build[2]

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
  nodeEnter.on('mouseover', function(d, index){
    if (pinned == 0) d3.selectAll('.node').attr('opacity', 0.2)
    else d3.selectAll('.node').attr('opacity', function(d,i){ return d.pinned ? 1 : 0.2 })
    d3.selectAll('.node' + d.bin).attr('opacity', 1)
    var element = d3.select(this)
    element.attr('opacity', 1)
    element.append('text')
      .text("1M")
      .attr('fill', function(d){ return rainbow(d.chromosome) })
      .attr('y', -8)
      .attr('x', 4)
      .attr('pointer-events', 'none')
      .attr('class', 'tooltip')
    element.append('text')
      .text(function(d){ return d.bin - segments[d.chromosome][0] })
      .attr('fill', '#fff')
      .attr('x', 4)
      .attr('pointer-events', 'none')
      .attr('class', 'tooltip')
    // d3.selectAll('.tile').filter(function(o){
    //   return o.i != d.bin && o.j != d.bin
    // }).attr('opacity', 0.2)
    for (var g = 0; g < genomes.length; g++) {
      drawCrosshair(g, index)
      for (var i = 0; i < chr.length; i++) {
        var segment = segments[chr[i]]
        var geometry = geometries[g][chr[i]]
        var mesh = meshes[g][chr[i]]
        var total = geometry.attributes.alpha.count
        var bins = segment[1] - segment[0]
        var size = parseInt(total / bins)
        for (var j = segment[0]; j < segment[1]; j++) {
          if (j == d.bin || all[j].pinned) for (var k = (j - segment[0]) * size; k < (j + 1 - segment[0]) * size; k++) geometry.attributes.alpha.array[k] = 0.8
          else for (var k = (j - segment[0]) * size; k < (j + 1 - segment[0]) * size; k++) geometry.attributes.alpha.array[k] = 0.2
        }
        geometry.attributes.alpha.needsUpdate = true
      }
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
    d3.select(this).selectAll('.tooltip').remove()
    d3.selectAll('.crosshair').remove()
    for (var g = 0; g < genomes.length; g++) {
      for (var i = 0; i < chr.length; i++) {
        var segment = segments[chr[i]]
        var geometry = geometries[g][chr[i]]
        var mesh = meshes[g][chr[i]]
        var total = geometry.attributes.alpha.count
        var bins = segment[1] - segment[0]
        var size = parseInt(total / bins)
        for (var j = segment[0]; j < segment[1]; j++) {
          if (pinned == 0 || all[j].pinned) for (var k = (j - segment[0]) * size; k < (j + 1 - segment[0]) * size; k++) geometry.attributes.alpha.array[k] = 0.8
          else for (var k = (j - segment[0]) * size; k < (j + 1 - segment[0]) * size; k++) geometry.attributes.alpha.array[k] = 0.2
        }
        geometry.attributes.alpha.needsUpdate = true
      }
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
  mapGraphs(cg.nodes, cg.others)

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

    node = null
    nodeEnter = null

  }
}

function animate() {
  requestAnimationFrame(animate)
  for (var g = 0; g < genomes.length; g++) controls[g].update()
  render()
}

function render() {
  for (var g = 0; g < genomes.length; g++) renderers[g].render(scenes[g], cameras[g])
}
