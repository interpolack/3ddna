function onWindowResize() {
  width = window.innerWidth
  height = window.innerHeight
  graph.container.attr('transform', 'translate(' + ((width - initialWidth) / 4) + ',0)scale(' + (height / initialHeight) + ')')
  graph.svg.attr('width', width * windowRatio).attr('height', height)
  linear.svg.attr('width', width * windowRatio)
  linear.svg.line.attr('width', (width * windowRatio) - 50)
  camera.aspect = width / (height - 250) * (1 - windowRatio)
  camera.updateProjectionMatrix()
  renderer.setSize(width * (1 - windowRatio), height - 250)
}

function onDocumentMouseMove(event) {
  // event.preventDefault()
  mouse.x = ((event.clientX - (width * windowRatio)) / renderer.domElement.clientWidth) * 2 - 1
  mouse.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1

  if (!shifting && dragging) {
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

  raycaster.setFromCamera(mouse, camera)
  var intersections = raycaster.intersectObjects(genome.children)
  var intersection = intersections.length > 0 ? intersections[0] : null

  if (shifting && intersection !== null && intersection.object.visible && intersection.object.name !== "") {
    if (pinned == 0 && navigation[navigated].context == 'chromosomes') {
      var chromosome = intersection.object.name
      var faceIndex = intersection.faceIndex
      var total = bufferGeometry[chromosome].attributes.alpha.count
      var bins = segments[chromosome][1] - segments[chromosome][0]
      var bin = parseInt(faceIndex / total * bins)
      alphaModel(0.2, navigation[navigated].chromosomes)
      alphaBin(chromosome, bin, 1)
      var node = graph.chromosomes.nodesDict[chromosome + ':' + bin]
      graph.svg.selectAll('.node').attr('opacity', function(d,i){ return i == node ? 1 : 0.2 })
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
            .attr('class', 'active highlight chr' + node.chromosome + '-' + node.bin)
          var ratio = 1 / (segments[0][1] - segments[0][0]) * ((width * windowRatio) - 70)
          linear.svg.chromosomes[node.chromosome].append('line')
            .attr('stroke', rainbow(node.chromosome))
            .attr('x1', 15 + 20 + (node.bin - segments[node.chromosome][0]) * ratio)
            .attr('x2', 15 + 20 + (node.bin - segments[node.chromosome][0]) * ratio)
            .attr('y1', 0)
            .attr('y2', 10)
            .attr('class', 'active highlight chr' + node.chromosome + '-' + node.bin)
        }
        chromosomes[node.chromosome].pinned = node.pinned = true
        pinned++
      }
    }
    if (navigation[navigated].context == 'genome') {
      for (var i = 0; i < chromosomes.length; i++) {
        var alphas = new Float32Array(bufferGeometry[i].attributes.alpha.count)
        if (pinned == 0 || chromosomes[i].pinned) for (var a = 0; a < bufferGeometry[i].attributes.alpha.count; a++) alphas[a] = 0.8
        else for (var a = 0; a < bufferGeometry[i].attributes.alpha.count; a++) alphas[a] = 0.2
        bufferGeometry[i].attributes.alpha = new THREE.BufferAttribute(alphas, 1)
      }
    } else if (navigation[navigated].context == 'chromosomes') {
      alphaModelFromGraph()
    }
    if (pinned != 0) d3.selectAll('.node').attr('opacity', function(d){ return d.pinned ? 1 : 0.2 })
    graph.marquee.remove()
    $('#unpin').css('visibility', pinned == 0 ? 'hidden' : 'visible')
  }
  dragging = false
}

function onDocumentKeyDown(event) {
  if (event.shiftKey) shifting = true
}

function onDocumentKeyUp(event) {
  event.preventDefault()
  if (shifting) {
    if (navigation[navigated].context == 'chromosomes') {
      if (pinned == 0) d3.selectAll('.node').attr('opacity', 1)
      else d3.selectAll('.node').attr('opacity', function(d,i){ return d.pinned ? 1 : 0.2 })
      alphaModelFromGraph()
    }
    shifting = false
  }
  if (navigated > 0 && (event.keyCode == 8 || event.keyCode == 46)) {
    navigated--
    navigate(navigated)
  }
  if (event.keyCode != 13) return
  var val = $('#search').val()
  if (val.length == 0 && pinned == 0) {
    navigate(navigation.length - 1)
  } else if (val.length > 0) {
    search(val)
  } else if (pinned > 0) {
    if (navigation[navigated].context == 'genome') {
      var pin = []
      var locus
      for (var i = 0; i < chromosomes.length; i++) {
        if (chromosomes[i].pinned) {
          pin.push(i)
          var center = bufferGeometry[i].boundingSphere.center
          locus = locus == null ? center : locus.add(center)
        }
      }
      locus.divideScalar(pin.length)
      $('#navigation').append("<div class='nav'><span class='icon'>&acd;</span> chromosome " + pin.map(function(c){ return chromosomeName(c) }).toString() + "</div>")
      navigation.push({
        'context': 'chromosomes',
        'node': '1Mb',
        'link': 'and',
        'chromosomes': pin,
        'locus': locus,
        'threshold': 50,
      })
    } else if (navigation[navigated].context == 'chromosomes') {
      var pin = []
      var nin = []
      var locus
      var nodes = graph.chromosomes.nodes
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i]
        if (!node.pinned) continue
        var bin = all[node.bin]
        pin.push(bin.bin)
        nin.push(i)
        var geometry = bufferGeometry[bin.chromosome]
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
      $('#navigation').append("<div class='nav'><span class='icon'>&there4;</span> bin " + string + "</div>")
      navigation.push({
        'context': 'bins',
        'node': '1Mb',
        'link': 'distance',
        'chromosomes': navigation[navigated].chromosomes,
        'bins': pin,
        'nodes': nin,
        'locus': locus,
      })
    }
    navigate(navigation.length - 1)
  }
}
