var forceLabels = function() {
  var self = {};

  var layout = d3.layout.force();

  // Default force layout values for anchor nodes
  var anchorParameters = {
    linkDistance: 1,
    friction: 0.1,
    charge: -30,
    gravity: 0.0,
    theta: 0.8,
    alpha: 0.1,
    linkStrength: 0.1,
    ticks: 500,
  };

  // Number of simulation iterations
  var ticks = anchorParameters.ticks;

  // Key that links points and labels for selection
  var key = 'd3-force-layout-key';

  var mapping = {};

  // Method for getting/setting force parameter
  var forceParam = function(name, p, ap) {
    if (p === undefined) return layout[name];
    layout[name](d => d.anchorNode ? (ap || anchorParameters[name]) : p);
    return self;
  };

  // Points in plot
  self.points;

  // Nodes that connect to labels (invisible)
  self.nodes;

  // Labels
  self.labels = [];

  // Links that connect nodes and labels
  self.links = [];

  // Svg elements and attributes
  self.link;
  self.node;
  self.linkAttrs;
  self.labelAttrs;

  // Accessor functions for force layout parameters
  self.linkDistance = (ld, lda) => forceParam('linkDistance', ld, lda);
  self.friction = (f, fa) => forceParam('friction', f, fa);
  self.charge = (c, ca) => forceParam('charge', c, ca);
  self.gravity = (g, ga) => forceParam('gravity', g, ga);
  self.theta = (t, ta) => forceParam('theta', t, ta);
  self.alpha = (a, aa) => forceParam('alpha', a, aa);
  self.ticks = (t) => {
    if (t === undefined) return ticks;
    ticks = t;
    return self;
  };
  self.size = (w, h) => {
    layout.size([w, h]);
    return self;
  };
  self.nodes = (points, x, y) => {
    self.points = points;
    self.nodes = points.map(d => {
      return {x: x(d), y: y(d), fixed: true, anchorNode: true};
    });
    layout.nodes(self.nodes);
    layout.links(self.links);
    return self;
  };

  self.linkSvg = (svg, attrs) => {
    self.link = svg;
    self.linkAttrs = attrs;
    return self;
  };
  self.labelSvg = (svg, attrs) => {
    self.node = svg;
    self.labelAttrs = attrs;
    return self;
  };
  self.pointSvg = (svg, k) => {
    key = k || key;
    svg.attr(key, (d, i) => {
      const name = key + '-' + i;
      mapping[name] = layout.nodes()[i];
      return name;
    });
    self.node.attr(key, (d, i) => key + '-' + i);
    return self;
  };

  self.tick = (tickFn) => {
    layout.on('tick', function() {
      tickFn(self.node, self.link);
    });
  };

  function start() {
    layout.start();
    for (var i = 0; i < ticks; i++) layout.tick();
    layout.stop();
    layout.start();
  }

  function update() {
    var l, g, n, lg, e;

    // Draw links
    self.link = self.link.data(self.links);

    l = self.link.enter().insert(self.linkAttrs.element, '.force-point');       // should this be class of group?
    if (self.linkAttrs.attrs) self.linkAttrs.attrs.forEach(attr => d3.selection.prototype.attr.apply(l, attr));
    if (self.linkAttrs.style) self.linkAttrs.style.forEach(attr => d3.selection.prototype.style.apply(l, attr));

    self.link.exit().remove();

    console.log(layout.links());

    // Root node for invisible nodes and labels (which both act as force nodes)
    self.node = self.node.data(self.nodes);
    g = self.node.enter().append('g').attr('class', d => d.anchorNode ? 'd3-force-label-node' : self.labelAttrs.class);
    g.call(d => d.anchorNode ? null : self.labelAttrs.drag);  // TODO might be able to call this at label group level? And user should be able to pass in own drag function (ex: with bounding)

    // Invisible nodes
    n = g.selectAll('.d3-force-label-node').append('circle').attr('r', 1).attr('opacity', 0);

    // Label group
    lg = g.selectAll('.' + self.labelAttrs.class).append('g');

    if (self.labelAttrs.attr) self.labelAttrs.attrs.forEach(attr => d3.selection.prototype.attr.apply(lg, attr));
    if (self.labelAttrs.style) self.labelAttrs.style.forEach(attr => d3.selection.prototype.style.apply(lg, attr));
    self.labelAttrs.elements.forEach(elem => {
      e = lg.append(elem.element);
      if (elem.attrs) elem.attrs.forEach(a => d3.selection.prototype.attr.apply(e, a));
      if (elem.style) elem.style.forEach(a => d3.selection.prototype.style.apply(e, a));
    });

    self.node.exit().remove();

    start();
  }

  self.start = () => start();

  // Add a label
  self.pop = (point) => {
    var k = point.attr(key);
    var data = mapping[k];

    var newNode = {fixed: false, anchorNode: false, x: data.x, y: data.y};
    newNode[key] = k;

    self.nodes.push(newNode);
    self.links.push({source: data, target: newNode});

    update();
  };

  // Remove a label
  self.remove = (point) => {

  };

  // Show a label that's been hidden
  self.show = (point) => {

  };

  // Hide a label that's showing
  self.hide = (point) => {

  };

  return self;
};

/*
  MIGHT BE HELPFUL: http://stackoverflow.com/questions/18509792/d3-force-directed-graph-different-shape-according-to-data-and-value-given/24792680#24792680
*/