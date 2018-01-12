import $ from 'jquery';
import _ from 'lodash';
import d3 from 'd3';
import Charting from 'js/shared-charts/charting-utilities.min';
import {
  formatBlueprintId,
  formatBlendedModelId,
  formatModelNumber,
  formatSampleSize } from 'js/filter/leaderboard-display-filter.min';

import {gettext} from 'js/modules/gettext.min';

export default {

  /* CHART IMPROVEMENTS */
  modelLegend: function(opt, labelLayout) {
    var data = opt.data;
    var selector = opt.selector;
    var height = opt.height;
    var legendWidth = opt.width;

    // Size, position, and text values for models in the legend
    var outerMargin = 25;
    var innerMargin = outerMargin + 20;
    var modelAttrs = {
      size: 45,
      x: outerMargin,
      y: 18,
      radius: 8,
      name: {
        x: innerMargin,
        y: 12,
        fontSize: '11px',
        opacity: 1,
        text: (d, i) => this.formatLegendModelName(d.modelType),
      },
      bpNumber: {
        x: innerMargin,
        y: 24,
        fontSize: '9px',
        opacity: 0.6,
        text: (d, i) => {
          // Blender
          if (d.blender && _.isArray(d.blender)) {
            // Speed curve
            if (d.lid && d.modelNumber) {
               return formatBlendedModelId()(d.blender) + ', ' + formatModelNumber()(d.modelNumber);
            }
            // Learning curve
            return formatBlendedModelId()(d.blender);
          }
          // Speed curve
          if (d.lid && d.modelNumber) {
            return formatBlueprintId()(d.bp) + ', ' + formatModelNumber()(d.modelNumber);
          }
          // Learning curve
          return formatBlueprintId()(d.bp);
        },
      },
      sampleFeatureName: {
        x: innerMargin,
        y: 35,
        fontSize: '9px',
        opacity: 0.6,
        text: (d, i) => {
          return d.lid ? formatSampleSize()(d.s) + ', ' + gettext(d.dsName) : gettext(d.dsName);
        }
      },
    };
    var legendHeight = data.length * modelAttrs.size;

    var container = d3.select(selector + ' .model-chart .models-container')
      .append('svg')
      .attr('class', 'model-legend')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .append('g');

    var models = container.selectAll('.legend-model')
      .data(data)
      .enter()
      .append('g')
      .attr('class', 'legend-model')
      .attr('transform', (d, i) => {
        d.ypos = i * modelAttrs.size;
        return 'translate(0, ' + d.ypos  + ')';
      })
      .attr('data-name', d => d.dataName);

    var mouseRects;

    // Helper function to add text to model in legend
    var addText = function(attrs) {
      models.append('text')
        .attr('class', attrs.class)
        .attr('x', attrs.x)
        .attr('y', attrs.y)
        .attr('font-size', attrs.fontSize)
        .attr('opacity', attrs.opacity)
        .attr('fill', '#fff')
        .attr('stroke', 'none')
        .attr('dy', '.35em')
        .attr('text-anchor', 'start')
        .attr('font-weight', 400)
        .text(attrs.text);
    };

    // Bubble expands on click
    models.append('circle')
      .attr('class', 'bubble')
      .attr('cx', modelAttrs.x)
      .attr('cy', modelAttrs.y)
      .attr('r', 0)
      .attr('fill', d => d.chartColor)
      .attr('opacity', 0);

    // Circle
    models.append('circle')
      .attr('class', 'legend-model-circle')
      .attr('cx', modelAttrs.x)
      .attr('cy', modelAttrs.y)
      .attr('r', modelAttrs.radius)
      .attr('stroke', d => d.chartColor);

    // Add text values: model name, model number & BP, sample percent and feature list name
    addText(modelAttrs.name);
    addText(modelAttrs.bpNumber);
    addText(modelAttrs.sampleFeatureName);

    // For mouseover
    mouseRects = models.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', legendWidth)
      .attr('height', modelAttrs.size)
      .attr('opacity', 0)
      .attr('cursor', 'pointer');

    mouseRects.on('mouseover', d => this.mouseover(selector, d.dataName))
      .on('mouseout', d => this.mouseout(selector))
      .on('click', d => this.click(selector, d.dataName, labelLayout));

    mouseRects.classed('clicked-point', false);

    // Make sure we can scroll down the entire list
    $(selector + ' .model-chart .models-container').css({'height': height - (modelAttrs.size * 2)});
  },

  labelLayout: function(container, data, dataKey, pointLabels, width, height, xscale, yscale) {
    var self = {};

    // Point, link, and label data
    self.points = data.points.map((d, i) => {
      return {
        x: xscale(d.x),
        y: yscale(d.y),
        fixed: true,
        anchorNode: true,
        color: d.chartColor,
        name: pointLabels[i],
      };
    });
    self.previewLabels = pointLabels.map((d, i) => {
      return {
        parent: self.points[i],
        name: d, dataName:
        data.points[i][dataKey]
      };
    });
    self.labels = [];
    self.links = [];

    // DataName to point index mapping
    var mapping = {};
    var key, val;
    pointLabels.forEach((d, i) => {
      key = data.points[i][dataKey];
      val = {point: self.points[i], name: pointLabels[i]};
      if (key in mapping) mapping[key].push(val);
      else mapping[key] = [val];
    });

    // Points clicked on
    var showing = new Set();

    // Force layout
    self.force = d3.layout.force()
      .linkDistance(30)
      .friction(0.1)
      .charge(d => d.anchorNode ? -30 : -2000)
      .gravity(0.0)
      .size([width, height])
      .nodes(self.points)
      .links(self.links);

    var rectHeight = 24;
    var borderHeight = 16;
    var radius = 5;
    var labelPadding = 29;
    var pad = {x: 15, y: 10};
    var opacity = {
      on: {stroke: 1, fill: 0.85, grip: 0.3},
      off: {stroke: 0, fill: 0, grip: 0},
    };
    var innerPadding;
    var xrange;
    var yrange;

    var bound_x = (d) => {
      if (!d.anchorNode) d.x = Math.max(0, Math.min(d.x, xrange[1] - d.width));
      return d.x + pad.x;
    };
    var bound_y = (d) => {
      if (!d.anchorNode) d.y = Math.max(yrange[1], Math.min(d.y, yrange[0] - (rectHeight / 2)));
      return d.y - pad.y;
    };

    var drag = self.force.drag()
      .on('dragstart', function(d) {
        d3.select(this).classed('fixed', d.fixed = true);
      })
      .on('drag', function(d) {
        // Prevent user from dragging out of bounds
        d.x = Math.max(0, Math.min(d3.event.x, xrange[1] - d.width));
        d.y = Math.max(yrange[1], Math.min(d3.event.y, yrange[0] - (rectHeight / 2)));
      });

    var formatLabel = (name) => {
      var parts = name.split('(');
      return parts[0] + '<tspan class="parenthetical">(' + parts[1] + '</tspan>';
    };

    self.link = container.append('g').attr('class', 'force-links').selectAll('.force-link');

    // Runs for each tick of the simulation, positioning labels w/r/t nodes
    self.force.on('tick', function() {
      // Position nodes
      self.node.attr('transform', d => 'translate(' + bound_x(d) + ',' + bound_y(d) + ')');

      // Position links
      self.link.attr('x1', d => d.source.x + innerPadding)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x + pad.x)
        .attr('y2', d => d.target.y - pad.y + (rectHeight / 2));
    });

    function start() {
      self.force.start();
      for (var i = 0; i < 500; i++) self.force.tick();
      self.force.stop();
      self.force.start();
    }

    function update() {
      // Draw links
      self.link = self.link.data(self.force.links());
      self.link.enter()
        .insert('line', '.force-point')
        .attr('class', 'force-link')
        .attr('stroke', d => d.source.color)
        .attr('opacity', 1);
      self.link.exit().remove();

      // Draw nodes
      self.node = self.node.data(self.force.nodes());
      var group = self.node.enter()
        .append('g')
        .attr('class', 'force-point')
        .attr('data-name', d => d.dataName)
        .attr('cursor', d => d.anchorNode ? 'default' : 'move')
        .call(drag);
      group.append('rect')
        .attr('class', 'force-point-container')
        .attr('width', d => d.anchorNode ? 2 : d.width)
        .attr('height', d => d.anchorNode ? 2 : rectHeight)
        .attr('rx', 2)
        .attr('ry', 2)
        .attr('fill-opacity', d => d.anchorNode ? 0 : 0.85)
        .attr('stroke-opacity', d => d.anchorNode ? 0 : 1);
      group.append('rect')
        .attr('class', 'force-point-border')
        .attr('x', -1.5)
        .attr('y', 4)
        .attr('width', d => d.anchorNode ? 0 : 3)
        .attr('height', d => d.anchorNode ? 0 : borderHeight)
        .attr('fill', d => d.color)
        .attr('opacity', d => d.anchorNode ? 0 : 1);
      group.append('text')
        .attr('x', 20)
        .attr('y', 16)
        .attr('opacity', 1)
        .html(d => d.anchorNode ? '' : formatLabel(d.name));

      Charting.gripSvg(group.append('g').attr('class', 'grip-container').attr('transform', 'translate(6, 7)').attr('opacity', 0.3));

      self.node.exit().remove();

      start();
    }

    function toggleHidden(dataName, opacity) {
      var node = self.node.filter(d => d.dataName === dataName);
      node.select('text').attr('opacity', opacity.stroke);
      node.select('.force-point-border').attr('opacity', opacity.stroke);
      node.select('.force-point-container').attr('stroke-opacity', opacity.stroke).attr('fill-opacity', opacity.fill);
      node.select('.grip-container').attr('opacity', opacity.grip);
      node.attr('cursor', opacity.stroke === 0 ? 'default' : 'move');
      self.link.filter(d => d.target.dataName === dataName).attr('opacity', opacity.stroke);

      // Bring point to front
      if (opacity.stroke === 0) self.svgPoints.filter(d => d[dataKey] === dataName).moveToFront();
      // Bring label to front
      else node.moveToFront();
    }

    self.init = function(group, xextent, yextent, innerMargin) {
      innerPadding = innerMargin || 0;
      pad.x = pad.x + innerPadding;
      xrange = xextent;
      yrange = yextent;

      self.svgPoints = group.selectAll('.point');
      self.previewLabel = group.selectAll('.preview-label');
      self.node = group.selectAll('.force-point');

      // Only displayed on hover
      self.previewLabel = self.previewLabel.data(self.previewLabels);
      self.previewLabel.enter()
        .append('text')
        .attr('class', 'preview-label')
        .attr('data-name', d => d.dataName)
        .attr('x', d => d.parent.x + innerPadding + 15)
        .attr('y', d => d.parent.y + 5)
        .attr('opacity', 0)
        .text(d => d.name);

      self.previewLabel.each(function(d, i) {
        self.points[i].width = Charting.getElemWidth(d3.select(this).node()) + labelPadding;
        if (parseFloat(d3.select(this).attr('x')) + self.points[i].width > xrange[1]) {
          d3.select(this).attr('transform', 'translate(-' + (self.points[i].width + 15) + ', 0)');
        }
      });

      group.selectAll('.point').moveToFront();

      update();
    };

    // Add a label to the force layout
    self.popLabel = function(dataName, clicked) {
      var pointData = mapping[dataName];

      // Remove point, label, link if already clicked
      if (clicked) {
        toggleHidden(dataName, opacity.off);
        self.force.start();
      } else if (showing.has(dataName)) {
        // If we've already seen it
        toggleHidden(dataName, opacity.on);
        self.force.start();
      } else {
        pointData.forEach((d, i) => {
          var newNode = {fixed: false, name: d.name, dataName: dataName, color: d.point.color, width: d.point.width};
          var newLabel = {name: d.name, parent: d.point, dataName: dataName, node: newNode};

          self.labels.push(newLabel);
          self.points.push(newNode);
          self.links.push({source: d.point, target: newNode});
        });

        showing.add(dataName);
        update();
      }
    };

    return self;
  },

  // Helper interaction functions
  mute: function(opacity) {
    return d3.select(this).transition().duration(100).attr('opacity', opacity);
  },
  hide: function() {
    return d3.select(this).attr('opacity', 0);
  },
  highlight: function() {
    return d3.select(this).transition().duration(100).attr('opacity', 1);
  },
  contractPoint: function(opacity) {
    return d3.select(this).transition().attr('r', 5).attr('stroke-width', 2).attr('opacity', opacity);
  },
  contractLine: function(opacity) {
    return d3.select(this).transition().attr('stroke-width', 2).attr('opacity', opacity);
  },
  slideOut: function() {
    return d3.select(this)
      .transition()
      .duration(150)
      .ease('exp-out')
      .attr('transform', d => 'translate(-5, ' + d.ypos + ')')
      .attr('opacity', 1);
  },
  slideIn: function(opacity) {
    return d3.select(this)
      .transition()
      .duration(150)
      .ease('exp-out')
      .attr('transform', d => 'translate(0, ' + d.ypos + ')')
      .attr('opacity', opacity);
  },
  transitionBubble: function(bubble, r, ease, opacity, duration) {
    return bubble.transition().duration(duration).ease(ease).attr('r', r).attr('opacity', opacity);
  },
  isLabelHidden: function(label) {
    return !d3.select(label)[0][0] || d3.select(label).select('text').attr('opacity') === '0';
  },
  isClicked: function(context) {
    return d3.select(context).classed('clicked-point');
  },
  isDefault: function(container) {
    var legendItems = container + ' .legend-model';
    return $(legendItems).not('.clicked-point').length === $(legendItems).length;
  },

  mouseover: function(container, gid) {
    var self = this;

    var selection = '[data-name=' + gid + ']';
    var point = container + ' .points .point' + selection;
    var line = container + ' .datalines ' + selection;
    var label = container + ' .points .force-point' + selection;

    var previewLabel = container + ' .points .preview-label' + selection;
    var points = container + ' .point';
    var lines = container + ' .line';
    var legendItems = container + ' .legend-model';
    var legendItem = container + ' .model-legend g ' + selection;
    var clicked = '.clicked-point';

    var transition = d3.transition().duration(150).ease('exp-out');

    // Highlight point(s) and line
    transition.select(line).attr('opacity', 1).attr('stroke-width', 4);
    transition.selectAll(point).attr('opacity', 1).attr('stroke-width', 4).attr('r', 8);

    // Highlight label (unless already clicked)
    if (self.isLabelHidden(label)) {
      d3.selectAll(previewLabel).attr('opacity', 1).moveToFront();
    }

    // Slide and highlight legend item
    $(legendItem).each(self.slideOut);
    $(legendItems).not(clicked).not(selection).each(function() {
      self.slideIn.apply(this, [0.5]);
    });

    // Mute everything else unless clicked
    $(points).not(selection).not(clicked).each(function() {
      self.contractPoint.apply(this, [0.2]);
    });
    $(lines).not(selection).not(clicked).each(function() {
      self.contractLine.apply(this, [0.2]);
    });
  },

  mouseout: function(container) {
    var self = this;

    var points = container + ' .point';
    var lines = container + ' .line';
    var labels = container + ' .preview-label';
    var legendItems = container + ' .legend-model';
    var clicked = '.clicked-point';

    d3.selectAll(labels).moveToBack();

    // If nothing is clicked restore to default state
    if (this.isDefault(container)) {
      $(legendItems).each(function() {
        self.slideIn.apply(this, [1]);
      });
      $(points).each(function() {
        self.contractPoint.apply(this, [1]);
      });
      $(lines).each(function() {
        self.contractLine.apply(this, [1]);
      });
    }
    // Otherwise mute unclicked items
    else {
      $(legendItems).not(clicked).each(function() {
        self.slideIn.apply(this, [0.5]);
      });
      $(points).not(clicked).each(function() {
        self.contractPoint.apply(this, [0.2]);
      });
      $(lines).not(clicked).each(function() {
        self.contractLine.apply(this, [0.2]);
      });
    }
    $(labels).each(self.hide);
  },

  click: function(container, gid, labelLayout) {
    var self = this;

    var selection = '[data-name=' + gid + ']';
    var point = d3.selectAll(container + ' .points .point' + selection);
    var line = d3.select(container + ' .datalines ' + selection);
    var link = d3.selectAll(container + ' .force-label-links ' + selection);
    var label = d3.selectAll(container + ' .points .preview-label' + selection);
    var labels = d3.selectAll(container + ' .preview-label');
    var legendItem = d3.select(container + ' .model-legend g ' + selection);
    var bubble = d3.select(container + ' .model-legend ' + selection + ' .bubble');
    var legendItems = container + ' .legend-model';
    var lines = container + ' .line';
    var points = container + ' .point';

    var clicked = point.classed('clicked-point');
    point.classed('clicked-point', !clicked);
    line.classed('clicked-point', !clicked);
    link.classed('clicked-point', !clicked);
    legendItem.classed('clicked-point', !clicked);
    labels.attr('opacity', 0);

    // Make the legend model bubble blossom
    if (clicked) {
      self.transitionBubble(bubble, 0, 'exp', 0, 150);
    } else {
      legendItem.attr('opacity', 1);
      self.transitionBubble(bubble, 14, 'exp-out', 1, 300);
    }

    // Mute others
    $(legendItems).not(selection).not('.clicked-point').each(function() {
      self.mute.apply(this, [0.5]);
    });
    $(points).not(selection).not('.clicked-point').each(function() {
      self.mute.apply(this, [0.2]);
    });
    $(lines).not(selection).not('.clicked-point').each(function() {
      self.mute.apply(this, [0.2]);
    });

    // Pop out a point
    labelLayout.popLabel(gid, clicked);
  },
  /* END CHART IMPROVEMENTS */


  addSvgLegend: function(isLc, container, linedata, legendWidth, groups, height) {
    const individualHeight = 40;
    const legendHeight = _.size(linedata) * individualHeight;

    // Learning curve uses groupids, SVA uses lids

    const legend = d3.select(container + ' .model-chart .models-container')
      .append('svg')
        .attr('class', 'legend-svg')
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .append('g')
          .attr('transform', 'translate(0,10)')
          .selectAll('.legend')
          .data(groups)
          .enter().append('g')
            .attr('class', 'legend')
            .attr('transform', (d, i) => 'translate(0,' + i * 40 + ')')
            .attr('data-name', (d) => d);

    legend.append('rect')
      .attr('x', 10)
      .attr('width', 20)
      .attr('height', 30)
      .style('fill', (d, i) => {
        return !isLc ? linedata[i].chartColor : linedata[d][0].chartColor;
      })
      .on('mouseover', (d, i) => {
        const obj = !isLc ? linedata[i].lid : linedata[d][0].groupid;
        this.mOver(container, obj);
      })
      .on('mouseout', () => this.resetStyle(false));

    // model name
    legend.append('text')
      .attr('x', 40)
      .attr('y', 4)
      .attr('dy', '.35em')
      .style('text-anchor', 'start')
      .style('font-size', '11px')
      .style('fill', 'rgba(230, 230, 230, 1)')
      .style('font-weight', '400')
      .text((d, i) => {
        const obj = !isLc ? linedata[i].modelType : linedata[d][0].modelType;
        return this.formatLegendModelName(obj);
      });

    // ModelNumber (If Applicable) && BP
    legend.append('text')
      .attr('x', 40)
      .attr('y', 16)
      .attr('dy', '.35em')
      .style('text-anchor', 'start')
      .style('font-size', '9px')
      .style('font-weight', '400')
      .style('fill', 'rgba(230, 230, 230, 0.6)')
      .text((d, i) => {
        const obj = !isLc ? linedata[i] : linedata[d][0];
        if (obj.blender && _.isArray(obj.blender)) {
          return !isLc && obj.modelNumber ?
              formatBlendedModelId()(obj.blender) + ', ' + formatModelNumber()(obj.modelNumber) :
              formatBlendedModelId()(obj.blender);
        }
        return !isLc && obj.modelNumber ?
            formatBlueprintId()(obj.bp) + ', ' + formatModelNumber()(obj.modelNumber) :
            formatBlueprintId()(obj.bp);
      });

    // SamplePCT (If Applicable)  && Featurelist name
    legend.append('text')
      .attr('x', 40)
      .attr('y', 27)
      .attr('dy', '.35em')
      .style('text-anchor', 'start')
      .style('font-size', '9px')
      .style('font-weight', '400')
      .style('fill', 'rgba(230, 230, 230, 0.6)')
      .text((d, i) => {
        let blah = '';
        const obj = !isLc ? linedata[i] : linedata[d][0];
        if (!isLc) {
          blah = formatSampleSize()(obj.s) + ', ';
        }
        return blah + gettext(obj.dsName);
      });
    $(container + ' .model-chart .models-container').css({'height': height});
  },

  clearChart: () => {
    if ($('#learning_curve_chart')) {
      d3.select('#learning_curve_chart').remove();
      $('#learning_curve_chart').remove();
    }
    if ($('.legend-svg')) {
      $('.legend-svg').remove();
    }
  },

  calculateExtents: function(winningScore) {
    // use Math.abs to prevent JS errors on negative values
    var maxExtent = null;
    var minExtent = null;
    var multiplier = 2;
    var baseScore = Math.abs( winningScore );
    if (baseScore === 0) {
      maxExtent = 5;
      minExtent = -5;
    } else if (baseScore < 0.1 && baseScore !== 0) {
      maxExtent = 1;
    } else if (baseScore > 0.1 && baseScore < 10) {
      multiplier = 10;
    } else if (baseScore > 10) {
      multiplier = 5;
    }
    if (maxExtent === null) {
      maxExtent = baseScore * multiplier;
    }
    if (minExtent === null) {
      minExtent = baseScore / multiplier;
    }
    return {
      min: minExtent,
      max: maxExtent,
    };
  },

  formatLegendModelName: function(modelType) {
    return modelType.length > 34 ?  modelType.substr(0, 32) + '...' : modelType;
  },

  modelHasValidScore: (model, metric) => {
    return model.Score && model.Score.completed && model.Score[metric];
  },

  mOver: (container, d) => {
    const groupid = d;

    var fadeOutLegends = $('.models-container .legend-svg .legend')
      .not('[data-name=' + groupid + ']');

    var fadeOutOthers = $('#learning_curve_chart .line, #learning_curve_chart .dot')
      .not('[data-name=' + groupid + ']');

    $.when(this.resetStyle).then(function() {
      // animation is nice but when a user hovers over elements too quickly,
      // the reset occurs but the animation is still happening resulting in
      // multiple labels and dots being large at once.
      // thesedots.transition().duration(100).attr('r', 15 );
      // theselines.transition().duration(100).attr('stroke-width', 5 );


      d3.selectAll('#learning_curve_chart .points [data-name=' + groupid + ']')
        .classed({'thisCurveActive': true, 'show': true})
        .attr('r', 10);
      d3.selectAll('#learning_curve_chart .datalines [data-name=' + groupid + ']')
        .classed({'thisCurveActive': true, 'show': true})
        .attr('stroke-width', 4);


      d3.select('.models-container .legend-svg [data-name=' + groupid + ']')
        .attr('class', 'legend highlight');

      d3.selectAll('#learning_curve_chart .labels [data-name=' + groupid + ']')
        .classed({'thisCurveActive': true, 'show': true, 'scorelabel': true, 'hidden': false});

      fadeOutOthers.each( function() {
        d3.select(this).classed({'thisCurveDeactive': true, 'show': false});
      });
      fadeOutLegends.each( function() {
        d3.select(this).classed({'thisCurveDeactive': true, 'show': false});
      });
      d3.selectAll('.bartext').classed('thisCurveActive', true);
    });
  },

  resetStyle: function() {
    d3.selectAll('.models-container .legend-svg .legend').attr('class', 'legend').classed({'thisCurveDeactive': false, 'thisCurveActive': true});
    d3.selectAll('#learning_curve_chart .dot').attr('r', 4).classed({'thisCurveDeactive': false, 'show': false});
    d3.selectAll('#learning_curve_chart .line').attr('stroke-width', 1.5).classed('thisCurveDeactive', false);
    d3.selectAll('#learning_curve_chart .labels text').classed({'thisCurveActive': false, 'hidden': true, 'scorelabel': true});
    d3.selectAll('.bartext').attr('opacity', '.6');
  },

  reFormatAsPercent: (svg, el) => {
    svg.selectAll(el).property('textContent', (d) => {
      return Math.round(parseFloat(d) * 1000) / 1000 + '%';
    });
  },

  setPartitioning: function(project) {
    return {
      baseTrainingSize: project.partitioning.baseTrainingSize,
      baseHoldoutSize: project.partitioning.baseHoldoutSize,
      baseValidationSize: project.partitioning.baseValidationSize,
      maxValue: project.getMaxSamplePercent(),
      smartSampleLimitPCT: project.partitioning.smartSampleLimitPCT,
      maxPctLimit: project.partitioning.maxPctLimit,
    };
  },
};