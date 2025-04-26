import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

let _instance = null;

export function renderDiagram({ nodes, links }, options = {}) {
  const {
    containerId     = "#diagram",
    zoomExtent      = 3,
    colorByCategory = true,
    nodeRadius      = 8,
    arrowOffset     = 6,
    currentLinkId   = null,
    subsequentIds   = []
  } = options;

  const keyOf = d => `${typeof d.source === 'object' ? d.source.id : d.source} -> ${typeof d.target === 'object' ? d.target.id : d.target}`;

  if (!_instance) {
    let _curLink    = currentLinkId;
    let _subIds     = [...subsequentIds];
    let _subSet     = new Set(_subIds);
    let _curTarget  = _curLink?.split('->')[1].trim();
    let _subTargets = [..._subSet].map(k => k.split('->')[1].trim());
    const visitedHistory = [];

    const arrowStates = { default: '#999', visited: '#6a5acd', next: 'orange', current: 'red' };

    const container = d3.select(containerId);
    container.selectAll('svg').remove();
    const svg = container.append('svg').attr('width', '100%').attr('height', '100%');
    const g   = svg.append('g').attr('class', 'zoom-layer');

    const zoomBehavior = d3.zoom()
      .scaleExtent([1/zoomExtent, zoomExtent])
      .on('zoom', ({transform}) => g.attr('transform', transform));
    svg.call(zoomBehavior).call(zoomBehavior.translateTo, 0, 0);

    const linkLayer = g.append('g').attr('class','link-layer');
    const arrowLayer = g.append('g').attr('class','arrow-layer');
    const nodeLayer = g.append('g').attr('class','node-layer');
    const labelLayer = g.append('g').attr('class','label-layer');

    const linkSel = linkLayer.selectAll('path.curve')
      .data(links, keyOf)
      .join('path')
        .attr('class','curve')
        .attr('fill','none');

    const arrowSel = arrowLayer.selectAll('path.arrow')
      .data(links, keyOf)
      .join('path')
        .attr('class','arrow');

    const nodeSel = nodeLayer.selectAll('circle')
      .data(nodes, d => d.id)
      .join('circle')
        .attr('r', nodeRadius)
        .attr('fill', d => colorByCategory ? d.color : '#ccc')
        .attr('id', d => `node-${d.id}`)
        .call(d3.drag().on('start', dragStart).on('drag', drag).on('end', dragEnd));

    const labelSel = labelLayer.selectAll('text')
      .data(nodes, d=>d.id)
      .join('text')
        .attr('dy', -nodeRadius-2)
        .attr('text-anchor','middle')
        .style('font-size',12)
        .style('paint-order','stroke')
        .style('stroke','white')
        .style('stroke-width',3)
        .text(d=>d.caption||d.label||d.id);

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d=>d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(svg.node().clientWidth/2, svg.node().clientHeight/2));

    let centeringMode = 'lock';

    function updateLinks(linkKey, subs) {
      if (_curLink && _curLink !== linkKey) {
        visitedHistory.push(_curLink);
        if (visitedHistory.length > 15) visitedHistory.shift();
      }
      _curLink    = linkKey;
      _subIds     = [...subs];
      _subSet     = new Set(_subIds);
      _curTarget  = _curLink?.split('->')[1].trim();
      _subTargets = [..._subSet].map(k => k.split('->')[1].trim());
      applyStyles();
    }

    function applyStyles() {
      const visitedSet = new Set(visitedHistory);

      linkSel.each(function(d) {
        const k = keyOf(d);
        let state = 'default';
        if (k === _curLink) state = 'current';
        else if (_subSet.has(k)) state = 'next';
        else if (visitedSet.has(k)) state = 'visited';
        d3.select(this)
          .attr('stroke', arrowStates[state])
          .attr('stroke-width', state==='current'?3.5:state==='next'?2.5:1.5);
      });

      arrowSel.each(function(d) {
        const k = keyOf(d);
        let state = 'default';
        if (k === _curLink) state = 'current';
        else if (_subSet.has(k)) state = 'next';
        else if (visitedHistory.includes(k)) state = 'visited';
        d._arrowState = state;
        d3.select(this).attr('fill', arrowStates[state]);
      });

      linkSel.filter(d => keyOf(d)===_curLink || _subSet.has(keyOf(d))).each(function() { this.parentNode.appendChild(this); });
      arrowSel.filter(d => keyOf(d)===_curLink || _subSet.has(keyOf(d))).each(function() { this.parentNode.appendChild(this); });
      nodeSel.filter(d => d.id === _curTarget || _subTargets.includes(d.id)).each(function() { this.parentNode.appendChild(this); });
      labelSel.filter(d => d.id === _curTarget || _subTargets.includes(d.id)).each(function() { this.parentNode.appendChild(this); });

      arrowSel.attr('d', arcArrow);

      nodeSel
        .attr('stroke', d => {
          if (d.id === _curTarget) return arrowStates.current;
          if (_subTargets.includes(d.id)) return arrowStates.next;
          const vis = [...visitedSet].some(k => k.split('->')[1].trim() === d.id);
          if (vis) return arrowStates.visited;
          return null;
        })
        .attr('stroke-width', d => {
          if (d.id === _curTarget) return 3;
          if (_subTargets.includes(d.id)) return 2;
          if ([...visitedSet].some(k => k.split('->')[1].trim() === d.id)) return 1.5;
          return 0;
        });
    }

    function arcCurve(d) {
      const dx = d.target.x - d.source.x;
      const dy = d.target.y - d.source.y;
      const dr = Math.hypot(dx, dy) * 1.2;
      const angle0 = Math.atan2(dy, dx);
      const off = nodeRadius + arrowOffset;
      const sx = d.source.x + off * Math.cos(angle0);
      const sy = d.source.y + off * Math.sin(angle0);
      const tx0 = d.target.x - off * Math.cos(angle0);
      const ty0 = d.target.y - off * Math.sin(angle0);
      const L = Math.hypot(tx0 - sx, ty0 - sy);
      const midX = (sx + tx0) / 2, midY = (sy + ty0) / 2;
      const h = Math.sqrt(Math.max(0, dr * dr - (L / 2) * (L / 2)));
      const ux = (tx0 - sx) / L, uy = (ty0 - sy) / L;
      const cx = midX - uy * h, cy = midY + ux * h;
      const rx = tx0 - cx, ry = ty0 - cy;
      const txv = -ry, tyv = rx;
      const tlen = Math.hypot(txv, tyv);
      const ux_t = txv / tlen, uy_t = tyv / tlen;
      const arrowL = 5;
      const bx = tx0 - arrowL * ux_t, by = ty0 - arrowL * uy_t;
      return `M${sx},${sy}A${dr},${dr} 0 0,1 ${bx},${by}`;
    }

    function arcArrow(d) {
      const k = keyOf(d);
      const isHighlighted = (k === _curLink) || _subSet.has(k);
      const scale = isHighlighted ? 2 : 1;

      const dx = d.target.x - d.source.x;
      const dy = d.target.y - d.source.y;
      const angle0 = Math.atan2(dy, dx);
      const off = nodeRadius + arrowOffset;
      const tx = d.target.x - off * Math.cos(angle0);
      const ty = d.target.y - off * Math.sin(angle0);

      const dr = Math.hypot(dx, dy) * 1.2;
      const sx = d.source.x + off * Math.cos(angle0);
      const sy = d.source.y + off * Math.sin(angle0);
      const L = Math.hypot(tx - sx, ty - sy);
      const midX = (sx + tx) / 2, midY = (sy + ty) / 2;
      const h = Math.sqrt(Math.max(0, dr*dr - (L/2)*(L/2)));
      const ux = (tx - sx) / L, uy = (ty - sy) / L;
      const cx = midX - uy * h, cy = midY + ux * h;
      const rx = tx - cx, ry = ty - cy;
      const txv = -ry, tyv = rx;
      const tlen = Math.hypot(txv, tyv);
      const ux_t = txv / tlen, uy_t = tyv / tlen;

      const arrowL = 5 * scale;
      const arrowW = arrowL / Math.sqrt(3);
      const bx = tx - arrowL * ux_t, by = ty - arrowL * uy_t;
      const p1x = bx + arrowW * uy_t;
      const p1y = by - arrowW * ux_t;
      const p2x = bx - arrowW * uy_t;
      const p2y = by + arrowW * ux_t;

      return `M${p1x},${p1y}L${tx},${ty}L${p2x},${p2y}Z`;
    }

    function dragStart(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    function drag(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    function dragEnd(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    function centerOnCurrentTarget(duration = 300) {
      const tgt = nodes.find(n => n.id === _curTarget);
      if (!tgt) return;
      centeringMode = duration > 0 ? 'none' : 'lock';
      if (duration > 0) {
        svg.transition().duration(duration).call(zoomBehavior.translateTo, tgt.x, tgt.y).on('end', () => centeringMode = 'lock');
      } else {
        svg.call(zoomBehavior.translateTo, tgt.x, tgt.y);
      }
    }

    simulation.on('tick', () => {
      linkSel.attr('d', arcCurve);
      arrowSel.attr('d', arcArrow);
      nodeSel.attr('cx', d => d.x).attr('cy', d => d.y);
      labelSel.attr('x', d => d.x).attr('y', d => d.y);
      if (centeringMode === 'lock' && _curTarget) {
        const t = nodes.find(n => n.id === _curTarget);
        if (t) svg.call(zoomBehavior.translateTo, t.x, t.y);
      }
      applyStyles();
    });

    // Node category legend
    const categories = Array.from(new Set(nodes.map(n => n.category)));
    const colorMap = {};
    nodes.forEach(n => {
      if (!colorMap[n.category]) colorMap[n.category] = n.color;
    });

    const nodeLegendGroup = svg.append("g")
    .attr("class", "node-legend")
    .attr("transform", "translate(16, 16)");
  
  nodeLegendGroup.selectAll("circle")
    .data(categories)
    .join("circle")
      .attr("cx", 6)
      .attr("cy", (_, i) => i * 20 + 6)
      .attr("r", 6)
      .attr("fill", d => colorMap[d])
      .attr("stroke", "white")
      .attr("stroke-width", 1.5);
  
  nodeLegendGroup.selectAll("text")
    .data(categories)
    .join("text")
      .attr("x", 18)
      .attr("y", (_, i) => i * 20 + 8)
      .style("font-size", "12px")
      .style("alignment-baseline", "middle")
      .style("paint-order", "stroke")
      .style("stroke", "white")
      .style("stroke-width", 3)
      .text(d => d);
  

    _instance = { updateLinks, centerOnCurrentTarget };
    window._diagramInstance = _instance;  // ✅ Correctly exposed at the end
  } else {
    _instance.updateLinks(currentLinkId, subsequentIds);
  }
  return _instance;
}
