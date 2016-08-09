function onWindowResize() {
  width = window.innerWidth
  height = window.innerHeight
  graph.container.attr('transform', 'translate(' + ((width - initialWidth) / 4) + ',0)scale(' + (height / initialHeight) + ')')
  graph.svg.attr('width', width * windowRatio).attr('height', height)
  linear.svg.attr('width', width * windowRatio)
  linear.svg.line.attr('width', (width * windowRatio) - 50)
  // camera.updateProjectionMatrix()
  for (var g = 0; g < genomes.length; g++) renderers[g].setSize(subWidth - 50, subWidth - 50)
}

function onDocumentMouseMove(event, g) {

  document.body.style.cursor = 'default'

  if (g == null && !shifting && dragging) {
    var a = {'x': click.x, 'y': click.y}
    var b = {'x': event.clientX, 'y': event.clientY}
    var x1 = a.x < b.x ? a.x : b.x
    var x2 = a.x > b.x ? a.x : b.x
    var y1 = a.y < b.y ? a.y : b.y
    var y2 = a.y > b.y ? a.y : b.y
    graph.marquee
      .attr('x', x1)
      .attr('y', y1)
      .attr('width', x2 - x1)
      .attr('height', y2 - y1)
  }

  if (event.target.nodeName != 'CANVAS') return

  var offset = event.target.getBoundingClientRect()
  var x = event.clientX - offset.left
  var y = event.clientY - offset.top

  mouse.x = (x / (subWidth - 50)) * 2 - 1
  mouse.y = -(y / (subWidth - 50)) * 2 + 1

  // TODO get appropriate 3D model target, or else only the first 3D viewer will allow 3D selections
  raycaster.setFromCamera(mouse, cameras[0]) // here
  var intersections = raycaster.intersectObjects(models[0].children) // here
  var intersection = intersections.length > 0 ? intersections[0] : null

  if (shifting && intersection !== null && intersection.object.visible && intersection.object.name !== "") {
    if (pinned == 0 && navigation[navigated].context == 'chromosomes') {
      var chromosome = intersection.object.name
      var faceIndex = intersection.faceIndex
      var total = geometries[0][chromosome].attributes.alpha.count // here
      var bins = segments[chromosome][1] - segments[chromosome][0]
      var bin = parseInt(faceIndex / total * bins)
      alphaModel(0.2, navigation[navigated].chromosomes)
      alphaBin(chromosome, bin, 1)
      $('.gene').remove()
      $('#navigation').append("<div class='gene'>" + genes[segments[chromosome][0] + bin].join("<br>") + "</div>")
      var node = graph.chromosomes.nodesDict[chromosome + ':' + bin]
      d3.selectAll('.node,.tile').attr('opacity', function(d,i){ return i == node || d.i == node || d.j == node ? 1 : 0.2 })
      for (var g = 0; g < genomes.length; g++) {
        d3.select('#graph' + g).selectAll('.node', function(d,i){ console.log(i, node); return i == node ? 1 : 0.2 })
      }
    }
  }
}

function onDocumentMouseDown(event) {
  graph.marquee = graph.svg.append('rect')
    .attr('rx', 2)
    .attr('stroke', '#fff')
    .attr('class', 'selection')
    .attr('x', event.clientX)
    .attr('y', event.clientY)
    .attr('fill', 'none')
    .attr('pointer-events', 'none')
  click.x = event.clientX
  click.y = event.clientY
  dragging = true
}

function onDocumentMouseUp(event) {
  if (!shifting && dragging && click.x != event.clientX && click.y != event.clientY) {
    var a = {'x': click.x, 'y': click.y}
    var b = {'x': event.clientX, 'y': event.clientY}
    var x1 = a.x < b.x ? a.x : b.x
    var x2 = a.x > b.x ? a.x : b.x
    var y1 = a.y < b.y ? a.y : b.y
    var y2 = a.y > b.y ? a.y : b.y
    var nodes = navigation[navigated].context == 'genome' ? graph.genome.nodes : graph.chromosomes.nodes
    var length = navigation[navigated].context == 'genome' ? chromosomes.length : graph.chromosomes.bins
    var pins = []
    for (var i = 0; i < length; i++) {
      var node = nodes[i]
      var nc = graph.context(node.px, node.py)
      if (nc.x > x1 && nc.x < x2 && nc.y > y1 && nc.y < y2) {
        if (navigation[navigated].context == 'genome' && !node.pinned) linear.svg.append('rect')
          .attr('fill', rainbow(node.chromosome))
          .attr('rx', 5)
          .attr('x', 20 + (segments[node.chromosome][0]) * linear.ratio)
          .attr('y', 70)
          .attr('width', atLeast((segments[node.chromosome][1] - segments[node.chromosome][0]) * linear.ratio, 10))
          .attr('height', 10)
          .attr('class', 'active highlight chr' + node.chromosome + '-all')
        else if (navigation[navigated].context == 'chromosomes' && !node.pinned) {
          linear.svg.append('line')
            .attr('stroke', rainbow(node.chromosome))
            .attr('x1', 20 + node.bin * linear.ratio)
            .attr('x2', 20 + node.bin * linear.ratio)
            .attr('y1', 70 + 0)
            .attr('y2', 70 + 10)
            .attr('class', 'pinned active highlight chr' + node.chromosome + '-' + node.bin)
          var ratio = 1 / (segments[0][1] - segments[0][0]) * ((width * windowRatio) - 70)
          linear.svg.chromosomes[node.chromosome].append('line')
            .attr('stroke', rainbow(node.chromosome))
            .attr('x1', 15 + 20 + (node.bin - segments[node.chromosome][0]) * ratio)
            .attr('x2', 15 + 20 + (node.bin - segments[node.chromosome][0]) * ratio)
            .attr('y1', 0)
            .attr('y2', 10)
            .attr('class', 'pinned active highlight chr' + node.chromosome + '-' + node.bin)
        }
        chromosomes[node.chromosome].pinned = node.pinned = true
        pins.push(i)
        pinned++
      }
    }
    d3.selectAll('.tile')
      .filter(function(d){
        return pins.indexOf(d.i) >= 0 || pins.indexOf(d.j) >= 0
      }).datum(function(d){
        d.pinned = true
        return d
      })
    if (navigation[navigated].context == 'genome') {
      for (var g = 0; g < genomes.length; g++) {
        if (genomes[g].type == '2D Matrix') continue
        for (var i = 0; i < chromosomes.length; i++) {
          var alphas = new Float32Array(geometries[g][i].attributes.alpha.count)
          if (pinned == 0 || chromosomes[i].pinned) for (var a = 0; a < geometries[g][i].attributes.alpha.count; a++) alphas[a] = 0.8
          else for (var a = 0; a < geometries[g][i].attributes.alpha.count; a++) alphas[a] = 0.2
          geometries[g][i].attributes.alpha = new THREE.BufferAttribute(alphas, 1)
        }
      }
    } else if (navigation[navigated].context == 'chromosomes') {
      alphaModelFromGraph()
    }
    if (pinned != 0) d3.selectAll('.node,.tile').attr('opacity', function(d){ return d.pinned ? 1 : 0.2 })
    graph.marquee.remove()
    $('#unpin').css('visibility', pinned == 0 ? 'hidden' : 'visible')
  }
  dragging = false
}

function onDocumentKeyDown(event) {
  if (event.shiftKey) {
    document.body.style.cursor = 'cell'
    shifting = true
  }
}

function onDocumentKeyUp(event) {
  event.preventDefault()
  if (shifting) {
    if (navigation[navigated].context == 'chromosomes') {
      if (pinned == 0) d3.selectAll('.node,.tile').attr('opacity', 1)
      else d3.selectAll('.node,.tile').attr('opacity', function(d,i){ return d.pinned ? 1 : 0.2 })
      alphaModelFromGraph()
    }
    document.body.style.cursor = 'default'
    $('.gene').remove()
    shifting = false
  }
  if (navigated > 0 && (event.keyCode == 8 || event.keyCode == 46)) {
    navigated--
    navigate(navigated)
  }
  if (event.keyCode != 13) return
  var val = $('#search').val()
  if (val.length > 0) {
    search(val)
  } else if (pinned == 0) {
    navigate(navigation.length - 1)
  } else if (pinned > 0) {
    if (navigation[navigated].context == 'genome') {
      var pin = []
      for (var i = 0; i < chromosomes.length; i++) {
        if (chromosomes[i].pinned) pin.push(i)
      }
      var loci = []
      for (var g = 0; g < genomes.length; g++) {
        if (genomes[g].type == '2D Matrix') continue
        var locus = null
        for (var i = 0; i < chromosomes.length; i++) {
          if (chromosomes[i].pinned) {
            var center = geometries[g][i].boundingSphere.center
            locus = locus == null ? center : locus.add(center)
          }
        }
        locus.divideScalar(pin.length)
        loci.push(locus)
      }
      $('#navigation').append("<div class='nav'><span class='icon'>&acd;</span> chromosome " + pin.map(function(c){ return chromosomeName(c) }).toString() + "</div>")
      navigation.push({
        'context': 'chromosomes',
        'node': '1Mb',
        'link': 'and',
        'chromosomes': pin,
        'loci': loci,
        'threshold': 30,
        'index': navigation.length,
      })
    } else if (navigation[navigated].context == 'chromosomes') {
      var pin = []
      var nin = []
      var nodes = graph.chromosomes.nodes
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i]
        if (!node.pinned) continue
        var bin = all[node.bin]
        pin.push(bin.bin)
        nin.push(i)
      }
      var loci = []
      for (var g = 0; g < genomes.length; g++) {
        var locus = null
        for (var i = 0; i < nodes.length; i++) {
          if (!nodes[i].pinned) continue
          var geometry = geometries[g][bin.chromosome]
          var total = geometry.attributes.position.count
          var segment = segments[bin.chromosome]
          var bins = segment[1] - segment[0]
          var size = parseInt(total / bins)
          var target = (nodes[i].bin - segment[0]) * size * 3
          var center = new THREE.Vector3(
            geometry.attributes.position.array[target],
            geometry.attributes.position.array[target + 1],
            geometry.attributes.position.array[target + 2]
          )
          locus = locus == null ? center : locus.add(center)
        }
        locus.divideScalar(pin.length)
        var string = pin.length == 1 ? pin[0] : pin[0] + "..." + pin[pin.length - 1]
        loci.push(locus)
      }
      $('#navigation').append("<div class='nav'><span class='icon'>&there4;</span> bin " + string + "</div>")
      navigation.push({
        'context': 'bins',
        'node': '1Mb',
        'link': 'distance',
        'chromosomes': navigation[navigated].chromosomes,
        'bins': pin,
        'nodes': nin,
        'loci': loci,
        'threshold': 30,
        'root': navigation[navigated].index,
      })
    } else if (navigation[navigated].context == 'bins') {
      var pin = []
      var nin = []
      var nodes = graph.chromosomes.nodes
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i]
        if (!node.pinned) continue
        var bin = all[node.bin]
        pin.push(bin.bin)
        nin.push(i)
      }
      var loci = []
      for (var g = 0; g < genomes.length; g++) {
        var locus = null
        for (var i = 0; i < nodes.length; i++) {
          if (!nodes[i].pinned) continue
          var geometry = geometries[g][bin.chromosome]
          var total = geometry.attributes.position.count
          var segment = segments[bin.chromosome]
          var bins = segment[1] - segment[0]
          var size = parseInt(total / bins)
          var target = (bin.bin - segment[0]) * size * 3
          var center = new THREE.Vector3(
            geometry.attributes.position.array[target],
            geometry.attributes.position.array[target + 1],
            geometry.attributes.position.array[target + 2]
          )
          locus = locus == null ? center : locus.add(center)
        }
        locus.divideScalar(pin.length)
        var string = pin.length == 1 ? pin[0] : pin[0] + "..." + pin[pin.length - 1]
        loci.push(locus)
      }
      $('#navigation').append("<div class='nav'><span class='icon'>&there4;</span> bin " + string + "</div>")
      navigation.push({
        'context': 'bins',
        'node': '1Mb',
        'link': 'distance',
        'chromosomes': navigation[navigated].chromosomes,
        'bins': pin,
        'nodes': nin,
        'loci': loci,
        'threshold': 30,
        'root': navigation[navigated].root,
      })
    }
    navigate(navigation.length - 1)
  }
}
