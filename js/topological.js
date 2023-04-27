// import * as d3 from "d3.js";


let main = document.querySelector('main');
let graph_svg = document.querySelector('#graph');

let w = window.innerWidth;
let h = window.innerHeight;

let categories_visible = false;

let primary_nodes = {
  p0: true,
  p1: true
}
let primary_node_str = { p0: "coffee", p1: "cancer" };

let intermediary_str = ['loop', 'mediating', 'confounding'];


let type_colors = {
  disease: { color: '#FEB3FF', checked: true },
  treatment: { color: '#7EF5CB', checked: true },
  genetic: { color: '#FFFF00', checked: true },
  behavior: { color: '#FFA07A', checked: true },
  symptom: { color: '#cba1ff', checked: true },
  other: { color: 'black', checked: true }
}

let map = {};
let graph_input;
let link_lists;
let nodes;


let graph;



setSize();
window.addEventListener('resize', setSize);

function setSize() {
  let sidebar = parseInt(getComputedStyle(document.body).getPropertyValue('--sidebar').replace('px', ''));
  w = window.innerWidth - sidebar - 20;
  h = window.innerHeight - 40;
  d3.select(graph_svg).attr('width', w + 'px');
  d3.select(graph_svg).attr('height', h + 'px');
  d3.select(graph_svg).attr('viewBox', `0 0 ${w} ${h}`);

}


fetch('../data/topo-data.json')
  .then((response) => response.json())
  .then((data) => {
    nodes = data.nodes;
    link_lists = data.links_categorized;

    init(link_lists, nodes);
    graph_input = generate_graph_input();
    graph = new Graph(graph_input.nodes, graph_input.links, graph_svg);

  });

function init(link_lists, nodes) {
  let keys = Object.keys(link_lists);

  for (let key of keys) {
    let parts = key.split('_')
    map[key] = {
      count: parts[0] == 'p0' && key == 'p0_downstream' || parts[0] == 'p1' && key == 'p1_upstream' ? 0 : link_lists[key].length
    };

    if (parts[0] !== 'primary') {
      map[key].field = parts.length > 1 ? document.querySelector(`#${parts[0]} div[data-name="${parts[1]}"]`) : document.querySelector(`div[data-name="${parts[0]}"]`)
      let range = map[key].field.querySelector('input');
      let counter = map[key].field.querySelector('.count');
      range.max = link_lists[key].length;
      range.value = parts[0] == 'p0' && key == 'p0_downstream' || parts[0] == 'p1' && key == 'p1_upstream' ? 0 : link_lists[key].length;


      // console.log(link_lists[key].length+']');
      counter.style.setProperty('--max', `"/${link_lists[key].length + ']'}"`);
      counter.innerText = link_lists[key].length;


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

  let key_section = document.querySelector('#key')

  for (let [type, color] of Object.entries(type_colors)) {
    let row = document.createElement('div')
    // let swatch=document.createElement('div');
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
    key_section.appendChild(row);
  }

  key_section.querySelector('input[type="checkbox"]').addEventListener('click', function () {
    categories_visible = key_section.querySelector('input[type="checkbox"]').checked;
    if (key_section.querySelector('input[type="checkbox').checked) main.classList.add('see-categories')
    else main.classList.remove('see-categories')

    graph.spacer=categories_visible?24:18;
    graph_input = generate_graph_input();
    graph.update(graph_input.nodes, graph_input.links);
  })

  // let directionality_input=document.querySelector('select[name="directionality"');
  // directionality_input.addEventListener('change',function(){
  //   graph_svg.dataset.directionality=directionality_input.value;
  // })

  document.querySelector('#graph-settings').querySelectorAll('select').forEach(select=>{
    select.addEventListener('change',function(){
      graph_svg.dataset[select.name]=select.value;
    })
  })

  document.querySelectorAll('input.primary').forEach((checkbox) => {
    checkbox.addEventListener('click', function () {
      for (let key of keys) {
        if (checkbox.checked && (key.includes(checkbox.dataset.name) || intermediary_str.includes(key))) {
          map[key].count = link_lists[key].length;
          map[key].field.querySelector('input').value = link_lists[key].length;
          map[key].field.querySelector('.count').innerText = link_lists[key].length;

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

  let start_pos=[0,0];
  let drag_pos=[0,0];
  graph_svg.addEventListener('mousedown',function(){
    start_pos=[event.clientX - drag_pos[0],event.clientY - drag_pos[1]];
    graph_svg.classList.add('drag')
    graph_svg.addEventListener('mousemove',graph_drag)
  })

  graph_svg.addEventListener('mouseup',function(){
    graph_svg.classList.remove('drag')
    // graph_svg.style.setProperty('--drag-x',0)
    // graph_svg.style.setProperty('--drag-y',0)
    graph_svg.removeEventListener('mousemove',graph_drag)
  })

  function graph_drag(){
    graph_svg.style.setProperty('--drag-x',event.clientX-start_pos[0]+'px')
    graph_svg.style.setProperty('--drag-y',event.clientY-start_pos[1]+'px')
    drag_pos=[event.clientX-start_pos[0],event.clientY-start_pos[1]]
  }

}


function generate_graph_input() {

  let links = [];

  for (let [key, list] of Object.entries(link_lists)) {
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




const Graph = class {
  constructor(nodes, links, svg) {

    this.nodes = nodes;
    this.links = links;
    this.box = d3.select(svg);

    this.spacer = 18;

    this.x_margin="6";
    this.y_margin="0";

    this.link = this.box.append("g")
      .attr('class', 'link-lines')
      .attr("stroke", "black")
      .attr("stroke-opacity", 1)
      .attr("stroke-width", 1)
      .attr("stroke-linecap", "round")
      .attr("vector-effect", "non-scaling-stroke")
      .selectAll("path")

    this.animate_link = this.box.append("g")
      .attr('class', 'animate')
      .attr("stroke", "black")
      .attr("stroke-opacity", 1)
      .attr("stroke-width", 1)
      .attr("stroke-linecap", "round")
      .attr("vector-effect", "non-scaling-stroke")
      .selectAll("path")


    this.arrow = this.box.append('g')
      .attr('class', 'link-arrows')
      .attr("stroke-linecap", "round")
      .attr("vector-effect", "non-scaling-stroke")
      .selectAll('path')



    this.node = this.box
      .append('g')
      .attr('class', 'node-circles')
      .attr("fill", "currentColor")
      .attr("stroke", "#fff")
      .attr("stroke-opacity", 1)
      .attr("stroke-width", 1)
      .selectAll("circle")
    
    this.label_bg=this.box
      .append("g")
      .attr('class','node-label-bgs')
      .selectAll("rect")

    this.label = this.box
      .append('g')
      .attr('class', 'node-labels')
      .selectAll('text')


    this.update(nodes, links);




    console.log(nodes, links, svg);
  }

  index_by_group() {
    this.counts = {
      feedback: 0,
      confounder: 0,
      mediator: 0,
      upstream_p0: 0,
      downstream_p1: 0,
      upstream_p1: 0,
      downstream_p0: 0
    }


    for (let node of this.nodes) {
      node.i = this.counts[node.group];
      this.counts[node.group]++;
    }
    console.log(this.spacer)
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
    if (node.group == 'p0') return w * 0.3;
    else if (node.group == 'p1') return w * 0.7;
    else if (node.group == 'upstream_p0' || node.group == 'confounder') return 20;
    else if (node.group == 'downstream_p1') return w * 0.9;
    else if (node.group == 'mediator' || node.group == 'feedback') return w * 0.5;


  }

  place_y(node) {
    if (node.group == 'p0' || node.group == 'p1') return h * 0.5;
    else if (node.group == 'upstream_p0') return h * 0.5 - (this.heights.upstream_p0 * 0.5) + node.i * this.spacer;
    else if (node.group == 'downstream_p1') return h * 0.5 - this.heights.downstream_p1 * 0.5 + node.i * this.spacer;
    else if (node.group == 'mediator') return h * 0.7 + node.i * this.spacer;
    else if (node.group == 'feedback') return h * 0.3 - this.heights.feedback + node.i * this.spacer;
    else if (node.group == 'confounder') return h * 0.5 + this.heights.upstream_p0 * 0.5 + (node.i + 2) * this.spacer;
  }

  update(nodes, links) {
    // Make a shallow copy to protect against mutation, while
    // recycling old nodes to preserve position and velocity.


    const old_node = new Map(this.node.data().map(d => [d.val, d]));
    const old_link = new Map(this.link.data().map(d => [d.source.val + '-' + d.target.val, d]));

    nodes = nodes.map(d => Object.assign(old_node.get(d.val) || {}, d));
    links = links.map(d => Object.assign(old_link.get(d.source + '-' + d.target) || {}, d));

    this.nodes = nodes;
    this.links = links;
    this.index_by_group(this.nodes);


    const link_gen = d3.linkHorizontal();
    const link_vert=d3.linkVertical();

    let labels = [
      {
        group: 'upstream_p0',
        i: -1
      },
      {
        group: 'downstream_p1',
        i: -1
      },
      {
        group: 'feedback',
        i: -1
      },
      {
        group: 'confounder',
        i: -1
      },
      {
        group: 'mediator',
        i: -1
      }
    ]

    for (let label of labels) {
      d3.select(`#${label.group}_label`)
        .attr('x', this.place_x(label))
        .attr('y', this.place_y(label))
    }

    this.animate_link = this.animate_link
      .data(links, d => d.source + '-' + d.target)
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
          .each((d,i,nodes)=>{
            nodes[i].style.animation = 'none';
            nodes[i].offsetHeight; /* trigger reflow */
            nodes[i].style.animation = null; 
          })
          .style('--str',(d,i,nodes)=>nodes[i].getTotalLength()+'px'),
        update => update
          .attr('d', d => {
            let src = this.nodes.find(a => a.val == d.source);
            let trg = this.nodes.find(a => a.val == d.target);
            return link_gen({
              source: [src.x, src.y],
              target: [trg.x, trg.y]
            })
          })
          .each((d,i,nodes)=>{
            nodes[i].style.animation = 'none';
            nodes[i].offsetHeight; /* trigger reflow */
            nodes[i].style.animation = null; 
          })
          .style('--str',(d,i,nodes)=>nodes[i].getTotalLength()+'px')
      )

    this.link = this.link
      .data(links, d => d.source + '-' + d.target)
      .join(
        enter => enter.append('path')
          .attr('class', (d) => `${d.type} ${d.sign}` )
          .attr('id',d=>d.source + '-' + d.target)
          .attr('d', d => {
            let src = this.nodes.find(a => a.val == d.source);
            let trg = this.nodes.find(a => a.val == d.target);
            return link_gen({
              source: [src.x, src.y],
              target: [trg.x, trg.y]
            })
          }).each(function (d,i,nodes) {
            // console.log(d,i,nodes[i])
            d.point=get_halfway_point(nodes[i])
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
          .each(function (d,i,nodes) {
            d.point=get_halfway_point(nodes[i])
          })
      )


    this.arrow = this.arrow
      .data(links, d => d.source + '-' + d.target)
      .join(enter => enter.append('path')
        .attr('d','M0.950256 1L2.95026 3L4.95026 5L0.950256 9')
        .attr('id',d=>d.type=='primary'?'arrow-primary':'')
        .style('transform',d=>`translate(${d.point.x}px,${d.point.y}px) rotate(${d.point.angle + 180}deg) translateX(-2px) translateY(-5px)`),
        update=>update
        .style('transform',d=>`translate(${d.point.x }px,${d.point.y}px) rotate(${d.point.angle + 180}deg) translateX(-2px) translateY(-5px)`)
        )
  

    this.node = this.node
      .data(nodes, (d) => d.val)
      .join(enter => enter.append('circle')
        .attr("r", 3)
        .attr('data-val', (d) => d.val)
        .attr('data-group', (d) => d.group)
        .attr('class', (d) => `node ${d.primary ? 'primary' : ''}`)
        .attr("cx", d => d.x)
        .attr("cy", d => d.y),
        update => update
          .attr("cx", d => d.x)
          .attr("cy", d => d.y))

    
          
    


    this.label = this.label
      .data(nodes, (d) => d.val)
      .join(
        enter => enter.append('text')
          .attr('class', (d) => `noselect ${d.primary ? 'primary' : ''} ${d.type ? 'has-type' : ''}`)
          .attr('data-val', (d) => d.val)
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
    
    this.label_bg=this.label_bg
      .data(nodes,(d)=>d.val)
      .join(enter=>enter.append('rect')
          .attr('class',(d)=>d.primary?'primary':'')
          .style('fill',(d)=>d.type?`var(--cat-${d.type})`:'none')
          .attr('rx',d => d.bbox.height/2)
          .attr('ry',d => d.bbox.height/2)
          .attr('data-type',(d)=>d.type)
          .attr("width", d =>{
            return d.bbox.width + this.x_margin*2 + 'px'
          })
          .attr("height", d => d.bbox.height + this.y_margin*2 + 'px')
          .attr("x", d => d.x)
          .attr("y", d => d.y),
        update=>update
          .attr("x", d => d.x)
          .attr("y", d => d.y),
      )



    //set node group based on:
    // p0 or p1
    // -> loop?
    // -> confounder?
    // -> mediator?
    // -> upstream p0
    // -> downstream p1
    // other stuff (pre-filter out)




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


  }





}





