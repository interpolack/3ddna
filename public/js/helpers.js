'use strict'

/*
/ convert 3D to 2D, useful for positioning 2D labels on 3D space
*/
function toScreenPosition(position, g) {
  var vector = new THREE.Vector3()
  var widthHalf = 0.5 * renderers[g].context.canvas.width
  var heightHalf = 0.5 * renderers[g].context.canvas.height
  // obj.updateMatrixWorld()
  // vector.setFromMatrixPosition(obj.matrixWorld)
  vector.set(position.x, position.y, position.z)
  vector.project(cameras[g])
  vector.x = (vector.x * widthHalf) + widthHalf
  vector.y = -(vector.y * heightHalf) + heightHalf
  return {
    x: vector.x,
    y: vector.y
  }
}

/*
/ draw a crosshait on a contact map, currently unused
*/
function drawCrosshair(g, index, center) {
  var submatrix = d3.select('#matrix' + g)
  var push = center ? 25 + submatrix.attr('size') / 2 : 25
  submatrix
    .append('line')
    .attr('stroke', '#fff')
    .attr('x1', push + index * submatrix.attr('size'))
    .attr('y1', 25)
    .attr('x2', push + index * submatrix.attr('size'))
    .attr('y2', subWidth - 75)
    .attr('class', 'crosshair')
  submatrix
    .append('line')
    .attr('stroke', '#fff')
    .attr('y1', push + index * submatrix.attr('size'))
    .attr('x1', push)
    .attr('y2', push + index * submatrix.attr('size'))
    .attr('x2', subWidth - 75)
    .attr('class', 'crosshair')
}

/*
/ use the graph's pinned values to set the opacity of the 3D models
*/
function alphaModelFromGraph(max) {
  var chr = graph.chromosomes.chr
  for (var g = 0; g < genomes.length; g++) {
    if (genomes[g].type == '2D Matrix') continue
    for (var i = 0; i < chr.length; i++) {
      var segment = segments[chr[i]]
      var geometry = geometries[g][chr[i]]
      var mesh = meshes[g][chr[i]]
      var total = geometry.attributes.alpha.count
      var bins = segment[1] - segment[0]
      var size = parseInt(total / bins)
      for (var j = segment[0]; j < segment[1]; j++) {
        if (max && all[j].found != null) for (var k = (j - segment[0]) * size; k < (j + 1 - segment[0]) * size; k++) geometry.attributes.alpha.array[k] = atLeast(all[j].found / max * 0.8, 0.3)
        else if (pinned == 0 || all[j].pinned) for (var k = (j - segment[0]) * size; k < (j + 1 - segment[0]) * size; k++) geometry.attributes.alpha.array[k] = 0.8
        else for (var k = (j - segment[0]) * size; k < (j + 1 - segment[0]) * size; k++) geometry.attributes.alpha.array[k] = 0.2
      }
      geometry.attributes.alpha.needsUpdate = true
    }
  }
}

/* set the opacity of the 3D models
/ alpha: opacity
/ visible: show these chromosomes but keep all other invisible
*/
function alphaModel(alpha, visible) {
  for (var g = 0; g < genomes.length; g++) {
    if (genomes[g].type == '2D Matrix') continue
    for (var i = 0; i < chromosomes.length; i++) {
      if (visible != null && visible.indexOf(i) == -1) meshes[g][i].visible = false
      else {
        meshes[g][i].visible = true
        var alphas = new Float32Array(geometries[g][i].attributes.alpha.count)
        for (var a = 0; a < geometries[g][i].attributes.alpha.count; a++) alphas[a] = alpha
        geometries[g][i].attributes.alpha = new THREE.BufferAttribute(alphas, 1)
      }
    }
  }
}

/*
/ hotlink to the UCSC genome browser
*/
function lookup(chromosome, bins) {
  var prefix = 'https://genome.ucsc.edu/cgi-bin/hgTracks?db=mm10&lastVirtModeType=default&lastVirtModeExtraState=&virtModeType=default&virtMode=0&nonVirtPosition=&position='
  var suffix = '&hgsid=501888851_Vr81OkrPRrUhSo3kt4U7ITltFimU'
  var target = 'chr' + chromosomeName(chromosome) + '%3A' + (bins[0] * 1000000) + '-' + (bins[1] * 1000000)
  window.open(prefix + target + suffix, '_blank')
  window.focus()
}

/*
/ distance function
*/
function distanceToSquared(x1, y1, z1, x2, y2, z2) {
  return Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2) + Math.pow(z2 - z1, 2)
}

/*
/ return the value only if it's greater than least
*/
function atLeast(value, least) {
  return value > least ? value : least
}

/*
/ convert the chromosome index to its name
*/
function chromosomeName(index) {
  return (index % 20) == 19 ? "X" : (index % 20) + 1
}

/*
/ handle panning and zooming the graph (panning has been disabled)
*/
function zoomed() {
  graph.container.selectAll('.node').selectAll('circle,text').attr('transform', 'scale(' + (((zoomToBin + 2) - d3.event.scale) / (zoomToBin + 1)) + ')')
  graph.container.attr('transform', 'translate(' + d3.event.translate + ')scale(' + d3.event.scale + ')')
}

/*
/ color a certain bin in the 3D models
*/
function colorBin(chromosome, bin, color) {
  for (var g = 0; g < genomes.length; g++) {
    var total = geometries[g][chromosome].attributes.position.count
    var bins = segments[chromosome][1] - segments[chromosome][0]
    var size = parseInt(total / bins)
    for (var v = bin * size; v < (bin + 1) * size; v++) {
      geometries[g][chromosome].attributes.color.array[(v * 3)] = color.r / 255
      geometries[g][chromosome].attributes.color.array[(v * 3) + 1] = color.g / 255
      geometries[g][chromosome].attributes.color.array[(v * 3) + 2] = color.b / 255
    }
    geometries[g][chromosome].attributes.color.needsUpdate = true
  }
}

/*
/ set the opacity of a certain bin on the 3D models
*/
function alphaBin(chromosome, bin, alpha) {
  for (var g = 0; g < genomes.length; g++) {
    var total = geometries[g][chromosome].attributes.alpha.count
    var bins = segments[chromosome][1] - segments[chromosome][0]
    var size = parseInt(total / bins)
    for (var v = bin * size; v < (bin + 1) * size; v++) {
      geometries[g][chromosome].attributes.alpha.array[v] = alpha
    }
    geometries[g][chromosome].attributes.alpha.needsUpdate = true
  }
}

/*
/ convert mouse position to graph coordinate space (skewed by zooming)
*/
function makeAbsoluteContext(element, svgDocument) {
  return function(x,y) {
    var offset = svgDocument.getBoundingClientRect()
    var matrix = element.getScreenCTM()
    return {
      x: (matrix.a * x) + (matrix.c * y) + matrix.e - offset.left,
      y: (matrix.b * x) + (matrix.d * y) + matrix.f - offset.top
    }
  }
}
