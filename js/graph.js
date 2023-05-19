// GLOBAL VARIABLE DEFINITIONS -------------------------------------

// DOM and D3 things
// ==================

let main = document.querySelector('main');
let dom_svg = document.querySelector('#graph');

//holds d3 selections of data-bound groups in the SVG
let svg = {
  //the svg itself
  box: undefined,
  //nodes (<circle>)
  node: undefined,
  //links (<path>)
  link: undefined,
  //link direction animations (<path>)
  animate_link: undefined,
  //arrows on links (path)
  arrow: undefined,
  //node labels (text)
  label: undefined,
  //node label colored backgrounds (rect)
  label_bg: undefined
}

let w = window.innerWidth;
let h = window.innerHeight;


// Data storage
// ============

let input_data_source = 'data/processed-data.json';

// saves data as fetched directly from source
let link_groups;
let nodes;

// holds filtered source data prepared for graph — see generate_graph_input()
let graph_input;

// holds shallow copy of graph_input to protect original data from mutation — see refresh_data()
let data = {
  nodes: undefined,
  links: undefined
}

// Graph status/control variables
// ==============================

// holds instantiated graph classes (see Force and Topological)
let topo;
let force;

// points to the graph instance for the current mode
let graph;

// settings
let mode = 'topological';
let mode_transition = false;
let categories_visible = false;
let primary_nodes = { p0: true, p1: true };

// this will record updated counts for different kinds of links
// set up in set_up_count_controls()
let map = {};


// Utilities
// =========

// placeholder variables and links for the link click interaction
let variables = [{ val: 'variable A', parent: 'source' }, { val: 'variable B', parent: 'source' }, { val: 'variable C', parent: 'source' }, { val: 'variable D', parent: 'source' }, { val: 'variable E', parent: 'source' }, { val: 'variable 1', parent: 'target' }, { val: 'variable 2', parent: 'target' }, { val: 'variable 3', parent: 'target' }, { val: 'variable 4', parent: 'target' }];
let variable_links = [{ source: 'variable A', target: 'variable 2' }, { source: 'variable 3', target: 'variable B' }, { source: 'variable 1', target: 'variable C' }, { source: 'variable D', target: 'variable 3' }, { source: 'variable 4', target: 'variable E' },{ source: 'variable E', target: 'variable 4' }];

// colors for different categories/types
let type_colors = { disease: { color: '#FDCCFF', checked: true }, treatment: { color: '#9EFFDD', checked: true }, genetic: { color: '#FFFFBD', checked: true }, behavior: { color: '#FFCFBD', checked: true }, symptom: { color: '#D2CCFF', checked: true }, other: { color: 'var(--bg)', checked: true } }

// sets names of primary nodes and intermediary categories
let primary_node_str = { p0: "coffee", p1: "cancer" };
let intermediary_str = ['loop', 'mediating', 'confounding'];










// INITIALIZATION SEQUENCE  -------------------------------------

fetch(input_data_source)
  .then((response) => response.json())
  .then((json) => {
    nodes = json.nodes;
    link_groups = json.link_groups;

    init(link_groups, nodes);

  });


function init(link_groups, nodes) {
  // (note: set-up functions can be found at the bottom of this document, below graph classes)

  //set up graph
  set_up_graph_dragging();
  set_up_d3();
  set_sizing();
  window.addEventListener('resize', set_sizing);

  //set up control panel
  set_up_count_controls(link_groups);
  set_up_category_controls()
  set_up_graph_settings()


  // generate graph input from fetched source data and initiate graph
  graph_input = generate_graph_input();
  topo = new Topological(graph_input.nodes, graph_input.links, dom_svg);
  force = new Force(graph_input.nodes, graph_input.links, dom_svg);
  graph = mode == 'topological' ? topo : force;

}




function generate_graph_input() {

  let links = [];

  for (let [key, list] of Object.entries(link_groups)) {
    let addition = [];
    if (list[0] && "links" in list[0]) {
      for (let i = 0; i < map[key].count; i++) {
        let group = list[i]
        addition = addition.concat(group.links)
      }

    } else {
      addition = list.slice(0, map[key].count);
    }

    links = links.concat(addition);
  }

  let nodes_relevant = nodes.filter(node => {
    return links.find(a => {
      return a.source == node.val || a.target == node.val;
    }) || node.primary && map.primary.count > 0;
  })

  if (categories_visible) {
    nodes_relevant = nodes_relevant.filter(node => {
      if (node.type) {
        return type_colors[node.type].checked || node.primary;
      } else {
        return type_colors.other.checked || node.primary;
      }
    })

    links = links.filter(link => {
      return nodes_relevant.find(node => node.val == link.source) && nodes_relevant.find(node => node.val == link.target)
    })
  }




  return {
    nodes: nodes_relevant,
    links: links
  }


}




function refresh_data(nodes, links) {
  // This function fires within the graph instances before a D3 update
  // It produces a shallow copy of graph input to protect against mutation, while
  // recycling old nodes to preserve position and velocity.
  // (derived from https://observablehq.com/@d3/modifying-a-force-directed-graph)

  const old_node = new Map(svg.node.data().map(d => [d.val, d]));
  const old_link = new Map(svg.link.data().map(d => [d.source.val + '-' + d.target.val, d]));

  data.nodes = nodes.map(d => Object.assign(old_node.get(d.val) || {}, d));
  data.links = links.map(d => Object.assign(old_link.get(d.source + '-' + d.target) || {}, d));
}




const Topological = class {
  constructor(nodes, links) {

    this.nodes = nodes;
    this.links = links;

    this.spacer = 18;
    this.x_margin = "6";
    this.y_margin = "0";

    this.in_focus = undefined;


    if (mode == 'topological') this.update(nodes, links);


  }

  update(nodes = this.nodes, links = this.links) {
    //this function is where the magic happens to build and live-update the graph

    //data update 
    refresh_data(nodes, links);
    this.nodes = data.nodes;
    this.links = data.links;

    // set x/y placement of nodes
    this.set_positions(this.nodes);

    // d3 function that generates a smooth bezier curve between two provided points
    const link_gen = d3.linkHorizontal();

    // D3 joins with updated data
    // ==========================

    svg.link = svg.link
      .data(data.links, d => d.source + '-' + d.target)
      .join(
        enter => enter.append('path')
          .attr('class', (d) => `${d.type} ${d.sign}`)
          .attr('id', d => d.source + '-' + d.target)
          .attr('d', d => {
            let src = this.nodes.find(a => a.val == d.source);
            let trg = this.nodes.find(a => a.val == d.target);
            return link_gen({
              source: [src.x, src.y],
              target: [trg.x, trg.y]
            })
          })
          .each(function (d, i, nodes) {
            // console.log(d,i,nodes[i])
            d.point = get_halfway_point(nodes[i])
          }),
        update => update
          .attr('d', d => {
            let src = this.nodes.find(a => a.val == d.source);
            let trg = this.nodes.find(a => a.val == d.target);
            return link_gen({
              source: [src.x, src.y],
              target: [trg.x, trg.y]
            })
          })
          .each(function (d, i, nodes) {
            d.point = get_halfway_point(nodes[i])
          })
      )

    svg.animate_link = svg.animate_link
      .data(data.links, d => d.source + '-' + d.target)
      .join(
        enter => enter.append('path')
          .attr('class', (d) => `${d.type} ${d.sign}`)
          .attr('d', d => {
            let src = this.nodes.find(a => a.val == d.source);
            let trg = this.nodes.find(a => a.val == d.target);
            return link_gen({
              source: [src.x, src.y],
              target: [trg.x, trg.y]
            })
          })
          .each((d, i, nodes) => {
            //( this does not seem to be working :/ )
            nodes[i].style.animation = 'none';
            nodes[i].offsetHeight; /* trigger reflow */
            nodes[i].style.animation = null;
          })
          .style('--str', (d, i, nodes) => nodes[i].getTotalLength() + 'px'),
        update => update
          .attr('d', d => {
            let src = this.nodes.find(a => a.val == d.source);
            let trg = this.nodes.find(a => a.val == d.target);
            return link_gen({
              source: [src.x, src.y],
              target: [trg.x, trg.y]
            })
          })
          .each((d, i, nodes) => {
            //( this does not seem to be working :/ )
            nodes[i].style.animation = 'none';
            nodes[i].offsetHeight; /* trigger reflow */
            nodes[i].style.animation = null;
          })
          .style('--str', (d, i, nodes) => nodes[i].getTotalLength() + 'px')
      )


    svg.hover_link = svg.hover_link
      .data(data.links, d => d.source + '-' + d.target)
      .join(
        enter => enter.append('path')
          .attr('d', d => {
            let src = this.nodes.find(a => a.val == d.source);
            let trg = this.nodes.find(a => a.val == d.target);
            return link_gen({
              source: [src.x, src.y],
              target: [trg.x, trg.y]
            })
          })
          .on('click', this.focus_link.bind(this))
          .on('mouseenter', this.link_mouseenter.bind(this)),
        update => update
          .attr('d', d => {
            let src = this.nodes.find(a => a.val == d.source);
            let trg = this.nodes.find(a => a.val == d.target);
            return link_gen({
              source: [src.x, src.y],
              target: [trg.x, trg.y]
            })
          })
      )

    svg.arrow = svg.arrow
      .data(data.links, d => d.source + '-' + d.target)
      .join(enter => enter.append('path')
        .attr('d', 'M0.950256 1L2.95026 3L4.95026 5L0.950256 9')
        .attr('id', d => d.type == 'primary' ? 'arrow-primary' : '')
        .style('transform', d => `translate(${d.point.x}px,${d.point.y}px) rotate(${d.point.angle + 180}deg) translateX(-2px) translateY(-5px)`),
        update => update
          .style('transform', d => `translate(${d.point.x}px,${d.point.y}px) rotate(${d.point.angle + 180}deg) translateX(-2px) translateY(-5px)`)
      )

    svg.node = svg.node
      .data(data.nodes, (d) => d.val)
      .join(enter => enter.append('circle')
        .attr("r", 3)
        .attr('data-val', (d) => d.val)
        .attr('data-group', (d) => d.group)
        .attr('class', (d) => `node ${d.primary ? 'primary' : ''}`)
        .on('mouseenter', this.node_mouseenter.bind(this))
        .attr("cx", d => d.x)
        .attr("cy", d => d.y),
        update => update
          .attr("cx", d => d.x)
          .attr("cy", d => d.y))

    svg.label = svg.label
      .data(data.nodes, (d) => d.val)
      .join(
        enter => enter.append('text')
          .attr('class', (d) => `noselect ${d.primary ? 'primary' : ''} ${d.type ? 'has-type' : ''}`)
          .attr('data-val', (d) => d.val)
          .on('mouseenter', this.node_mouseenter.bind(this))
          .text((d) => d.val)
          .each(function (d) {

            d.bbox = this.getBBox();
          })
          .attr("x", d => d.x)
          .attr("y", d => d.y),
        update => update
          .attr("x", d => d.x)
          .attr("y", d => d.y)
      )

    svg.label_bg = svg.label_bg
      .data(data.nodes, (d) => d.val)
      .join(enter => enter.append('rect')
        .attr('class', (d) => d.primary ? 'primary' : '')
        .style('fill', (d) => d.type ? `var(--cat-${d.type})` : 'var(--cat-other)')
        .attr('rx', d => d.bbox.height / 2)
        .attr('ry', d => d.bbox.height / 2)
        .attr('data-type', (d) => d.type)
        .attr("width", d => {
          return d.bbox.width + this.x_margin * 2 + 4 + 'px'
        })
        .attr("height", d => d.bbox.height + this.y_margin * 2 + 'px')
        .attr("x", d => d.x)
        .attr("y", d => d.y),
        update => update
          .attr("x", d => d.x)
          .attr("y", d => d.y),
      )

    // sets up the labels of each group of nodes to be placed using the same placing function as the nodes
    let groupings = [{ group: 'upstream_p0', i: -1 }, { group: 'downstream_p1', i: -1 }, { group: 'feedback', i: -1 }, { group: 'confounder', i: -1 }, { group: 'mediator', i: -1 }]
    for (let grouping of groupings) {
      d3.select(`#${grouping.group}_label`)
        .attr('x', this.place_x(grouping))
        .attr('y', this.place_y(grouping))
        .attr('display', this.counts[grouping.group] > 0 ? 'block' : 'none')
    }

    // properly resets graph after switching from force to topological mode
    if (mode_transition) {
      svg.node
        .on('click', null)
        .on(".drag", null)
      svg.label
        .on('click', null)
        .on(".drag", null)
      svg.label_bg
        .on('click', null)
        .on(".drag", null)
      svg.hover_link
        .on('click', this.focus_link.bind(this))
        .on('mouseenter', this.mouseenter.bind(this))
    }

    // configures graph if currently focusing on a specific link
    if (this.in_focus !== undefined && svg.box.classed('focus-mode')) {

      let parents = {
        source: this.nodes.find(a => a.val == this.in_focus.source),
        target: this.nodes.find(a => a.val == this.in_focus.target)
      }
     

      svg.v_node = svg.v_node
        .data(variables, (d) => d.val)
        .join(enter => enter.append('circle')
          .each((d) => {
            d.i = variables.filter(a => a.parent == d.parent).indexOf(d);
            d.x = parents[d.parent].x;
            d.y = parents[d.parent].y + (d.i + 1) * this.spacer;
          })
          .attr("r", 3)
          .attr('data-val', (d) => d.val)
          .attr('data-group', (d) => d.group)
          .attr('class', (d) => `node ${d.primary ? 'primary' : ''}`)
          .attr("cx", (d) => d.x)
          .attr("cy", (d, i) => d.y),
          update => update
            .each((d) => {

              d.x = parents[d.parent].x;
              d.y = parents[d.parent].y + (d.i + 1) * this.spacer;
            })
            .attr("cx", (d) => d.x)
            .attr("cy", (d) => d.y))

      svg.v_link = svg.v_link
        .data(variable_links, d => d.source + '-' + d.target)
        .join(
          enter => enter.append('path')
            .attr('d', d => {
              let src = variables.find(a => a.val == d.source);
              let trg = variables.find(a => a.val == d.target);
              return link_gen({
                source: [src.x, src.y],
                target: [trg.x, trg.y]
              })
            })
            .each(function (d, i, nodes) {
              d.point = get_halfway_point(nodes[i])
            }),
          update => update
            .attr('d', d => {
              let src = variables.find(a => a.val == d.source);
              let trg = variables.find(a => a.val == d.target);
              return link_gen({
                source: [src.x, src.y],
                target: [trg.x, trg.y]
              })
            })
            .each(function (d, i, nodes) {
              d.point = get_halfway_point(nodes[i])
            })
        )

      svg.v_animate_link = svg.v_animate_link
      .data(variable_links, d => d.source + '-' + d.target)
      .join(
        enter => enter.append('path')
          .attr('d', d => {
            let src = variables.find(a => a.val == d.source);
            let trg = variables.find(a => a.val == d.target);
            return link_gen({
              source: [src.x, src.y],
              target: [trg.x, trg.y]
            })
          })
          .style('--str', (d, i, nodes) => nodes[i].getTotalLength() + 'px'),
        update => update
          .attr('d', d => {
            let src = variables.find(a => a.val == d.source);
            let trg = variables.find(a => a.val == d.target);
            return link_gen({
              source: [src.x, src.y],
              target: [trg.x, trg.y]
            })
          })
          .style('--str', (d, i, nodes) => nodes[i].getTotalLength() + 'px')
      )

      svg.v_arrow = svg.v_arrow
        .data(variable_links, d => d.source + '-' + d.target)
        .join(enter => enter.append('path')
          .attr('d', 'M0.950256 1L2.95026 3L4.95026 5L0.950256 9')
          .attr('id', d => d.type == 'primary' ? 'arrow-primary' : '')
          .style('transform', d => `translate(${d.point.x}px,${d.point.y}px) rotate(${d.point.angle + 180}deg) translateX(-2px) translateY(-5px)`),
          update => update
            .style('transform', d => `translate(${d.point.x}px,${d.point.y}px) rotate(${d.point.angle + 180}deg) translateX(-2px) translateY(-5px)`)
        )
      
      svg.v_label = svg.v_label
        .data(variables, (d) => d.val)
        .join(
          enter => enter.append('text')
            .text((d) => d.val)
            .attr("x", d => d.x)
            .attr("y", d => d.y),
          update => update
            .attr("x", d => d.x)
            .attr("y", d => d.y)
        )
    }


    mode_transition = false;

  }

  set_positions() {
    // this counts how many of different types of nodes there are
    // in order to set the heights of each node grouping on the graph
    // and then uses those heights to set the x and y values of each node in the dataset

    this.counts = { feedback: 0, confounder: 0, mediator: 0, upstream_p0: 0, downstream_p1: 0, upstream_p1: 0, downstream_p0: 0}

    for (let node of this.nodes) {
      node.i = this.counts[node.group];
      this.counts[node.group]++;
    }

    this.heights = {
      upstream_p0: this.counts.upstream_p0 * this.spacer,
      downstream_p1: this.counts.downstream_p1 * this.spacer,
      confounder: this.counts.confounder * this.spacer,
      mediator: this.counts.mediator * this.spacer,
      feedback: this.counts.feedback * this.spacer
    }

    for (let node of this.nodes) {
      node.x = this.place_x(node);
      node.y = this.place_y(node);
    }
  }

  place_x(node) {
    // sets x placement of node based on its group
    let graph_w=Math.max(w,800);


    if (node.group == 'p0') return graph_w * 0.3;
    else if (node.group == 'p1') return graph_w * 0.7;
    else if (node.group == 'upstream_p0' || node.group == 'confounder') return 20;
    else if (node.group == 'downstream_p1') return graph_w * 0.9;
    else if (node.group == 'mediator' || node.group == 'feedback') return graph_w * 0.5;
  }

  place_y(node) {
    // sets y placement of node based on its group

    if (node.group == 'p0' || node.group == 'p1') return h * 0.5;
    else if (node.group == 'upstream_p0') return h * 0.5 - (this.heights.upstream_p0 * 0.5) + node.i * this.spacer;
    else if (node.group == 'downstream_p1') return h * 0.5 - this.heights.downstream_p1 * 0.5 + node.i * this.spacer;
    else if (node.group == 'mediator') return h * 0.7 + node.i * this.spacer;
    else if (node.group == 'feedback') return h * 0.3 - this.heights.feedback + node.i * this.spacer;
    else if (node.group == 'confounder') return h * 0.5 + this.heights.upstream_p0 * 0.5 + (node.i + 2) * this.spacer;
  }


  link_mouseenter(event, d) {
    // link hover event handling
    let link = svg.link.filter((el) => el.source == d.source && el.target == d.target);
    let arrow = svg.arrow.filter((el) => el.source == d.source && el.target == d.target || el.target == d.source && el.source == d.target);
    let hover_margin = d3.select(event.srcElement);
    d3.selectAll('.hover').classed('hover', false);
    link.classed('hover', true)
    arrow.classed('hover', true);
    this.in_focus = d;
    hover_margin.on('mouseleave', function () {
      link.classed('hover', false)
      arrow.classed('hover', false);
      hover_margin.on('mouseleave', null)
    })

  }

  node_mouseenter(event, d) {
  
    // link hover event handling
    let node = svg.node.filter((el) => el.val == d.val);
    let label = svg.label.filter((el) => el.val == d.val);

    let arrows = svg.arrow.filter((el) => el.source == d.val || el.target == d.val);
    let links = svg.link.filter((el) => el.source == d.val || el.target == d.val);

    let hover_margin = d3.select(event.srcElement);
    d3.selectAll('.hover').classed('hover', false);
    node.classed('hover', true)
    label.classed('hover', true)
    links.classed('hover', true)
    arrows.classed('hover', true);
    // this.in_focus = d;
    hover_margin.on('mouseleave', function () {
      links.classed('hover', false)
      arrows.classed('hover', false);
      node.classed('hover', false)
      label.classed('hover', false)
      node.on('mouseleave', null)
    })

  }

  focus_link(event, d) {
    // initiates focus on link
    
    let link = svg.link.filter((el) => el.source == d.source && el.target == d.target);
    let arrow = svg.arrow.filter((el) => el.source == d.source && el.target == d.target || el.target == d.source && el.source == d.target);
    let src_node = svg.node.filter((el) => el.val == d.source);
    let trg_node = svg.node.filter((el) => el.val == d.target);
    let src_label = svg.label.filter((el) => el.val == d.source);
    let trg_label = svg.label.filter((el) => el.val == d.target);
    let src_label_bg = svg.label_bg.filter((el) => el.val == d.source);
    let trg_label_bg = svg.label_bg.filter((el) => el.val == d.target);

    let focused = d3.selectAll([...link, ...arrow, ...src_node, ...trg_node, ...src_label, ...trg_label, ...src_label_bg, ...trg_label_bg])

    if (d.source == this.in_focus.source && d.target == this.in_focus.target) {
      focused.classed('focus', true);

      svg.box.classed('focus-mode', true);

      setTimeout(function () {
        let drag = false;
        svg.box.on('mousedown', () => { drag = false });
        svg.box.on('mousemove', () => { drag = true });
        svg.box.on('mouseup', function (event) {
          if (!drag && !d3.select(event.srcElement).classed('focus')) {
            defocus()
          }
        })

      }, 100)

    }

    this.update();

  }

}



const Force = class {
  constructor(nodes, links, svg) {

    this.x_margin = "6";
    this.y_margin = "0";
    this.type_colors = type_colors

    // simulation settings
    // ===================

    this.forceNode = d3.forceManyBody();
    this.forceNode.strength(-2000);
    this.forceLink = d3.forceLink().id(d => d.val);
    this.forceLink.strength(2);
    this.forceCollide = d3.forceCollide(10)
    this.forceLink.distance(() => { return 140; });
    this.downstream_p1 = this.isolate(d3.forceX(w * 2), function (d) {
      return d.downstream_p1;
    }).strength(0.8);
    this.upstream_p0 = this.isolate(d3.forceX(w * -2), function (d) {
      return d.upstream_p0;
    }).strength(0.8);

    //initiate simulation with settings
    this.simulation = d3.forceSimulation()
      .force("link", this.forceLink)
      .force("charge", this.forceNode)
      .force("collide", this.forceCollide)
      .force("upstream_p0", this.upstream_p0)
      .force("downstream_p1", this.downstream_p1)
      .on("tick", this.ticked.bind(this));

    if (mode == 'force') this.update(nodes, links);


  }

  update(nodes, links) {


    refresh_data(nodes, links);


    // refreshes simulation with new data
    this.simulation
      .force("link", this.forceLink)
      .force("charge", this.forceNode)
      .force("collide", this.forceCollide)
      .force("upstream_p0", this.upstream_p0)
      .force("downstream_p1", this.downstream_p1);
    this.simulation.nodes(data.nodes);
    this.simulation.force("link").links(data.links);
    this.simulation.alpha(1).restart();


    // D3 joins with updated data
    // ==========================

    svg.link = svg.link
      .data(data.links, d => d.source.val + '-' + d.target.val)
      .join('path')
      .attr('class', (d) => `${d.type} ${d.sign}`);

    svg.animate_link = svg.animate_link
      .data(data.links, d => d.source.val + '-' + d.target.val)
      .join('path')
      .attr('class', (d) => `${d.type} ${d.sign}`);

    svg.arrow = svg.arrow
      .data(data.links, d => d.source + '-' + d.target)
      .join(enter => enter.append('path')
        .attr('d', 'M0.950256 1L2.95026 3L4.95026 5L0.950256 9')
        .attr('id', d => d.type == 'primary' ? 'arrow-primary' : ''))

    svg.node = svg.node
      .data(data.nodes, (d) => d.val)
      .join(enter => enter.append('circle')
        .attr("r", 3)
        .attr('data-val', (d) => d.val)
        .attr('class', (d) => `node ${d.primary ? 'primary' : ''}`)
        .each(function (d) {
          if (d.val == 'coffee') {
            d.fx = w / 4;
            d.fy = h / 4;
          } else if (d.val == 'cancer') {
            d.fx = w / 4 * 3;
            d.fy = h / 4 * 3;
          }
        })
        .call(this.drag(this.simulation))
        .on('click', this.clicked.bind(this)),
        update => update.each(function (d) {
          if (mode_transition) {
            if (d.val == 'coffee') {
              d.fx = w / 4;
              d.fy = h / 4;
            } else if (d.val == 'cancer') {
              d.fx = w / 4 * 3;
              d.fy = h / 4 * 3;
            }
          }
        }))

    svg.label = svg.label
      .data(data.nodes, (d) => d.val)
      .join(enter => enter.append('text')
        .attr('class', (d) => `noselect ${d.primary ? 'primary' : ''} ${d.type ? 'has-type' : ''}`)
        .attr('data-val', (d) => d.val)
        .text((d) => d.val)
        .call(this.drag(this.simulation))
        .each(function (d) { d.bbox = this.getBBox(); })
        .on('click', this.clicked.bind(this)))


    svg.label_bg = svg.label_bg
      .data(data.nodes, (d) => d.val)
      .join(enter => enter.append('rect')
        .attr('class', (d) => d.primary ? 'primary' : '')
        .style('fill', (d) => d.type ? `var(--cat-${d.type})` : 'none')
        .style('opacity', 1)
        .attr('rx', d => d.bbox.height / 2)
        .attr('ry', d => d.bbox.height / 2)
        .attr('data-type', (d) => d.type)
        .attr("width", d => d.bbox.width + this.x_margin * 2 + 4 + 'px')
        .attr("height", d => d.bbox.height + this.y_margin * 2 + 'px')
        .call(this.drag(this.simulation))
      )
    
    // resets things properly after transition from topological to force mode
    if (mode_transition) {
      svg.node
        .call(this.drag(this.simulation))
        .on('click', this.clicked.bind(this))
      svg.label
        .call(this.drag(this.simulation))
        .on('click', this.clicked.bind(this))
      svg.label_bg
        .call(this.drag(this.simulation))
        .on('click', this.clicked.bind(this))
      svg.hover_link
        .on('click', null)
        .on('mouseenter', null)
    }
    
    mode_transition = false;



  }


  clicked(event, d) {
    // resets fixed node

    delete d.fx;
    delete d.fy;
    this.simulation.alpha(1).restart();
  }

  drag(simulation) {
    //drags node and fixes it in place

    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
    }

    return d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }

  ticked() {
    // updates positions according to simulation

    if (mode == 'force') {
      svg.link
        .attr('d', d => `M${d.source.x},${d.source.y}A0,0 0 0,1 ${d.target.x},${d.target.y}`)
        .each(function (d, i, nodes) {
          // console.log(d,i,nodes[i])
          d.point = get_halfway_point(nodes[i])
        })

      svg.animate_link
        .style('--str', (d, i, nodes) => nodes[i].getTotalLength() + 'px')
        .attr('d', d => `M${d.source.x},${d.source.y}A0,0 0 0,1 ${d.target.x},${d.target.y}`)


      svg.arrow
        .style('transform', d => `translate(${d.point.x}px,${d.point.y}px) rotate(${d.point.angle + 180}deg) translateX(-2px) translateY(-5px)`);


      svg.label
        .attr("x", d => d.x)
        .attr("y", d => d.y);

      svg.label_bg
        .attr("x", d => d.x)
        .attr("y", d => d.y);

      svg.node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);
    }

  }

  updateSim(setting, value) {
    //force-specific graph settings changes

    switch (setting) {
      case 'radius':
        this.simulation.force('collide').radius(value)
        break;
      default:
        this.simulation.force(setting).strength(value);
    }
    this.simulation.alpha(0.8).restart();

  }

  isolate(force, filter) {
    let initialize = force.initialize;

    force.initialize = (nodes) => {
      return initialize.call(force, nodes.filter(filter));
    }
    return force;
  }


}










// SET-UP FUNCTIONS ---------------------------------------------------

function set_up_category_controls() {
  let category_controls = document.querySelector('#category-controls')

  for (let [type, color] of Object.entries(type_colors)) {
    let row = document.createElement('div')

    let swatch = document.createElement('input')
    swatch.setAttribute('type', 'color')
    swatch.value = color.color;
    let text = document.createElement('span');
    let checkbox = document.createElement('input')
    checkbox.setAttribute('type', 'checkbox');
    checkbox.checked = true;
    checkbox.addEventListener('change', function () {
      type_colors[type].checked = checkbox.checked;
      graph_input = generate_graph_input();
      graph.update(graph_input.nodes, graph_input.links)

    })

    row.classList.add('row-wrap')
    row.classList.add('color')
    row.style.setProperty('--color', `var(--cat-${type})`)
    text.innerText = type;


    row.appendChild(checkbox)
    if (type !== 'other') {
      swatch.classList.add('swatch')
      row.appendChild(swatch)
      swatch.addEventListener('input', function () {
        document.documentElement.style.setProperty(`--cat-${type}`, swatch.value);
      })
    } else {
      row.dataset.type = type;
    }
    row.appendChild(text);
    category_controls.appendChild(row);
  }

  category_controls.querySelector('input[type="checkbox"]').addEventListener('click', function () {
    categories_visible = category_controls.querySelector('input[type="checkbox"]').checked;
    if (category_controls.querySelector('input[type="checkbox').checked) main.classList.add('see-categories')
    else main.classList.remove('see-categories')

    graph.spacer = categories_visible ? 24 : 18;
    graph_input = generate_graph_input();
    graph.update(graph_input.nodes, graph_input.links);
  })
}


function set_up_graph_dragging() {
  let start_pos = [0, 0];
  let drag_pos = [0, 0];
  dom_svg.addEventListener('mousedown', function () {
    start_pos = [event.clientX - drag_pos[0], event.clientY - drag_pos[1]];
    dom_svg.classList.add('drag')
    dom_svg.addEventListener('mousemove', graph_drag)
  })

  dom_svg.addEventListener('mouseup', function () {
    dom_svg.classList.remove('drag')
    dom_svg.removeEventListener('mousemove', graph_drag)
  })

  function graph_drag() {
    dom_svg.style.setProperty('--drag-x', event.clientX - start_pos[0] + 'px')
    dom_svg.style.setProperty('--drag-y', event.clientY - start_pos[1] + 'px')
    drag_pos = [event.clientX - start_pos[0], event.clientY - start_pos[1]]
  }
}

function set_up_count_controls(link_groups) {
  let keys = Object.keys(link_groups);

  //sets up controls for numbers of different types of nodes to display, and builds map object to keep track of those counts
  for (let key of keys) {
    let parts = key.split('_')
    map[key] = {
      count: parts[0] == 'p0' && key == 'p0_downstream' || parts[0] == 'p1' && key == 'p1_upstream' ? 0 : link_groups[key].length
    };

    if (parts[0] !== 'primary') {
      map[key].field = parts.length > 1 ? document.querySelector(`#${parts[0]} div[data-name="${parts[1]}"]`) : document.querySelector(`div[data-name="${parts[0]}"]`)
      let range = map[key].field.querySelector('input');
      let counter = map[key].field.querySelector('.count');
      range.max = link_groups[key].length;
      range.value = parts[0] == 'p0' && key == 'p0_downstream' || parts[0] == 'p1' && key == 'p1_upstream' ? 0 
        : key == 'p1_downstream' || key == 'p0_upstream' ?  Math.min(29,link_groups[key].length) 
        : Math.min(15,link_groups[key].length);
      map[key].count = parseInt(range.value);
      console.log(key,range.value)

      counter.style.setProperty('--max', `"/${link_groups[key].length + ']'}"`);
      counter.innerText =range.value;


      range.addEventListener('input', function () {
        counter.innerText = range.value;
      })

      range.addEventListener('change', function () {
        counter.innerText = range.value;
        map[key].count = parseInt(range.value);
        graph_input = generate_graph_input();
        graph.update(graph_input.nodes, graph_input.links)
      })
    }

  }

  //sets up control to switch between seeing one primary topic or both
  document.querySelectorAll('input.primary').forEach((checkbox) => {
    checkbox.addEventListener('click', function () {
      for (let key of keys) {
        if (checkbox.checked && (key.includes(checkbox.dataset.name) || intermediary_str.includes(key))) {
          map[key].count = link_groups[key].length;
          map[key].field.querySelector('input').value = link_groups[key].length;
          map[key].field.querySelector('.count').innerText = link_groups[key].length;

        } else if (key.includes(checkbox.dataset.name) || intermediary_str.includes(key)) {
          map[key].count = 0;
          map[key].field.querySelector('input').value = 0;
          map[key].field.querySelector('.count').innerText = 0;

        }
      }
      primary_nodes[checkbox.dataset.name] = checkbox.checked;
      let other_one = checkbox.dataset.name == 'p0' ? 'p1' : 'p0';
      map.primary.count = checkbox.checked ? 1 : 0;
      if (checkbox.checked) main.classList.remove('focus-' + other_one);
      else main.classList.add('focus-' + other_one);

      graph_input = generate_graph_input();
      graph.update(graph_input.nodes, graph_input.links)

    })
  })
}


function set_up_graph_settings() {
  document.querySelector('#graph-settings').querySelectorAll('select').forEach(select => {
    select.addEventListener('change', function () {
      main.dataset[select.name] = select.value;
      dom_svg.dataset[select.name] = select.value;

      if (select.name == 'graph_type') {
        defocus();
        mode_transition = true;
        if (mode == 'topological') {
          mode = 'force';
          graph = force;

          graph.update(graph_input.nodes, graph_input.links)
        } else if (mode == 'force') {
          graph.simulation.stop();
          mode = 'topological';

          map['p0_downstream'].count = 0;
          map['p0_downstream'].field.querySelector('input[type="range"]').value = 0;
          map['p0_downstream'].field.querySelector('.count').innerText = 0;
          map['p1_upstream'].count = 0;
          map['p1_upstream'].field.querySelector('input[type="range"]').value = 0;
          map['p1_upstream'].field.querySelector('.count').innerText = 0;
          graph_input = generate_graph_input();

          graph = topo;
          graph.spacer = categories_visible ? 24 : 18;
          graph.update(graph_input.nodes, graph_input.links)
        }
      }

    })
  })

  document.querySelectorAll('#graph-settings .row-wrap').forEach((field) => {
    let range = field.querySelector('input[type="range"]');
    if (range) {
      let counter = field.querySelector('.count');
      range.addEventListener('change', function () {
        if (mode == 'force') {
          counter.innerText = range.value;
          force.updateSim(field.dataset.name, range.value);
        }

      })

    }


  })
}

function set_up_d3() {
  svg.box = d3.select(dom_svg);

  svg.link = svg.box.insert("g",'.labels')
    .attr('class', 'link-lines')
    .attr("stroke", "black")
    .attr("stroke-opacity", 1)
    .attr("stroke-width", 1)
    .attr("stroke-linecap", "round")
    .attr("vector-effect", "non-scaling-stroke")
    .selectAll("path")

  svg.animate_link = svg.box.insert("g",'.labels')
    .attr('class', 'animate')
    .attr("stroke", "black")
    .attr("stroke-opacity", 1)
    .attr("stroke-width", 1)
    .attr("stroke-linecap", "round")
    .attr("vector-effect", "non-scaling-stroke")
    .selectAll("path")


  svg.arrow = svg.box.insert('g','.labels')
    .attr('class', 'link-arrows')
    .attr("stroke-linecap", "round")
    .attr("vector-effect", "non-scaling-stroke")
    .selectAll('path')



  svg.node = svg.box
    .append('g')
    .attr('class', 'node-circles')
    .attr("fill", "currentColor")
    .attr("stroke", "#fff")
    .attr("stroke-opacity", 1)
    .attr("stroke-width", 1)
    .selectAll("circle")

  svg.label_bg = svg.box
    .append("g")
    .attr('class', 'node-label-bgs')
    .selectAll("rect")

  svg.label = svg.box
    .append('g')
    .attr('class', 'node-labels')
    .selectAll('text')
    .attr('class', 'link-lines')
    .attr("stroke", "black")
    .attr("stroke-opacity", 1)
    .attr("stroke-width", 1)
    .attr("stroke-linecap", "round")
    .attr("vector-effect", "non-scaling-stroke")
    .selectAll("path")

  svg.animate_link = svg.box.insert("g",'.labels')
    .attr('class', 'animate')
    .attr("stroke", "black")
    .attr("stroke-opacity", 1)
    .attr("stroke-width", 1)
    .attr("stroke-linecap", "round")
    .attr("vector-effect", "non-scaling-stroke")
    .selectAll("path")

  svg.hover_link = svg.box.append('g')
    .attr('class', 'hover-link')
    .attr("stroke", "transparent")
    .attr("stroke-opacity", 1)
    .attr("stroke-width", 10)
    .attr("stroke-linecap", "round")
    .attr("vector-effect", "non-scaling-stroke")
    .selectAll("path")

  svg.v_animate_link = svg.box.insert("g",'.labels')
    .attr('class', 'variable-animate')
    .attr("stroke", "black")
    .attr("stroke-opacity", 1)
    .attr("stroke-width", 1)
    .attr("stroke-linecap", "round")
    .attr("vector-effect", "non-scaling-stroke")
    .selectAll("path")

  svg.v_link = svg.box.append("g")
    .attr('class', 'variable-links')
    .attr("stroke", "black")
    .attr("stroke-opacity", 1)
    .attr("stroke-width", 1)
    .attr("stroke-linecap", "round")
    .attr("vector-effect", "non-scaling-stroke")
    .selectAll("path")

  svg.v_arrow = svg.box.append('g')
    .attr('class', 'variable-arrows')
    .attr("stroke-linecap", "round")
    .attr("vector-effect", "non-scaling-stroke")
    .selectAll('path')

  
  
  // svg.v_link = svg.box.append("g")
  //   .attr('class', 'variable-links')
  //   .attr("stroke", "black")
  //   .attr("stroke-opacity", 1)
  //   .attr("stroke-width", 1)
  //   .attr("stroke-linecap", "round")
  //   .attr("vector-effect", "non-scaling-stroke")
  //   .selectAll("path")

  svg.arrow = svg.box.append('g')
    .attr('class', 'link-arrows')
    .attr("stroke-linecap", "round")
    .attr("vector-effect", "non-scaling-stroke")
    .selectAll('path')



  svg.node = svg.box
    .append('g')
    .attr('class', 'node-circles')
    .attr("fill", "currentColor")
    .attr("stroke", "#fff")
    .attr("stroke-opacity", 1)
    .attr("stroke-width", 1)
    .selectAll("circle")

  svg.label_bg = svg.box
    .append("g")
    .attr('class', 'node-label-bgs')
    .selectAll("rect")

  svg.label = svg.box
    .append('g')
    .attr('class', 'node-labels')
    .selectAll('text')


  svg.v_node = svg.box
    .append('g')
    .attr('class', 'variable-circles')
    .attr("fill", "currentColor")
    .attr("stroke", "#fff")
    .attr("stroke-opacity", 1)
    .attr("stroke-width", 1)
    .selectAll("circle")

  svg.v_label = svg.box
    .append('g')
    .attr('class', 'variable-labels')
    .selectAll('text')


}

function set_sizing() {
  let sidebar = parseInt(getComputedStyle(document.body).getPropertyValue('--sidebar').replace('px', ''));
  w = window.innerWidth - sidebar - 20;
  h = window.innerHeight - 40;
  svg.box.attr('width', w + 'px');
  svg.box.attr('height', h + 'px');
  svg.box.attr('viewBox', `0 0 ${w} ${h}`);
}




// UTILITY FUNCTIONS ---------------------------------------------------


function get_halfway_point(path) {
  let length = path.getTotalLength();
  let half = path.getPointAtLength(length / 2 + 10);
  let half_offset = path.getPointAtLength(length / 2 + 10.1);
  return {
    x: half.x,
    y: half.y,
    angle: Math.atan2(half.y - half_offset.y, half.x - half_offset.x) * (180 / Math.PI)
  }
}

function defocus() {
  d3.selectAll('.focus').classed('focus', false)
  svg.box.classed('focus-mode', false);
  svg.box.on('mouseup', null);
  svg.box.on('mousemove', null);
}