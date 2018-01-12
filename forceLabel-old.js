/*
  - ticks should probably be continuous paths
  - tick offset should be a function of font size (or label height? or label first letter height?)
*/

d3.forceLabels = function() {
  var self = {};

  var bound_x = function(d) {
    return d3.max([self.left, d3.min([d.x, self.right])]);
  };
  var bound_y = function(d) {
    return d3.max([self.top, d3.min([d.y, self.bottom])]);
  };

  var line = d3.svg.line().x(d => d.x).y(d => d.y);

  var labelTick = function(link, linkdata, label) {
    var x = parseFloat(link.attr('x2'));
    var y = parseFloat(link.attr('y2'));
    var orientation = linkdata.target.x < linkdata.source.x ? -1 : 1;
    var offset = self.offset * orientation;
    var pathdata = [{x: x, y: y}, {x: x + offset, y: y}];
    var path = self.tickGroup.append('path')
      .attr('d', line(pathdata))
      .attr('class', self.link.attr('class'))
      .attr('stroke', self.link.attr('stroke'))
      .attr('stroke-width', self.link.attr('stroke-width'))
      .attr('stroke-opacity', self.link.attr('stroke-opacity'));
    var offset_x = orientation < 0 ? -label.node().getBBox().width - 2 : 2;
    var offset_y = label.node().getBBox().height / 4;   // used to be 3
    label.attr('x', pathdata[1].x + offset_x).attr('y', pathdata[1].y + offset_y);
  };

  var layout = d3.layout.force()
    .charge(-600)
    .linkDistance(1)
    .friction(0.05)
    .gravity(0.01);

  self.offset = 8;

  layout.boundaries = function(top, left, bottom, right) {
    self.top = top;
    self.left = left;
    self.bottom = bottom;
    self.right = right;

    layout.size([right, bottom]);
    return layout;
  };

  layout.xscale = function(xscale) {
    self.xscale = xscale;
    return layout;
  };
  layout.yscale = function(yscale) {
    self.yscale = yscale;
    return layout;
  };

  layout.offset = function(offset) {
    self.offset = offset ? offset : 5;
    return layout;
  };

  layout.points = function(points) {
    self.points = points;
    return layout;
  };

  layout.labels = function(labels) {
    self.labels = [];
    self.nodes = [];

    self.points.forEach(function(d, i) {
      var x = self.xscale(d.x);
      var y = self.yscale(d.y);
      self.nodes.push({x: x, y: y, fixed: true});
      self.labels.push({x: x, y: y, fixed: false, name: labels[i]});
    });

    self.nodes.push(...self.labels);

    self.links = self.points.map((d, i) => {
      return {source: i, target: i + self.labels.length};
    });

    layout.nodes(self.nodes).links(self.links);

    return layout;
  };

  layout.init = function(svg) {
    self.node = svg.append('g')
      .attr('class', 'd3-force-points')
      .selectAll('.d3-force-point')
      .data(self.nodes)
      .enter()
      .append('circle')
      .attr('class', 'd3-force-point')
      .attr('r', 5)
      .attr('opacity', 0);
    self.tickGroup = svg.append('g').attr('class', 'd3-force-ticks');
    return layout;
  };

  layout.addLinks = function(linkSvg) {
    self.link = linkSvg.data(self.links).enter().append('line');
    return self.link;
  };

  layout.addText = function(textSvg) {
    self.labelSvg = textSvg.data(self.labels)
      .enter()
      .append('text')
      .text(d => d.name);
    return self.labelSvg;
  };

  layout.on('tick', function() {
    self.link.attr('x1', d => bound_x(d.source))
      .attr('y1', d => bound_y(d.source))
      .attr('x2', d => bound_x(d.target))
      .attr('y2', d => bound_y(d.target));

    self.node.attr('cx', bound_x).attr('cy', bound_y);
  });

  layout.run = function(niter) {
    var n = niter || 500;

    layout.start();
    for (var i = 0; i < n; i++) layout.tick();
    layout.stop();

    self.link.each(function(d, i) {
      labelTick(d3.select(this), self.links[i], d3.select(self.labelSvg[0][i]));
    });
  };

  return layout;
};