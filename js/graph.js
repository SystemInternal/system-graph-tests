// import * as d3 from "d3.js";


let main = document.querySelector('main');
let graph_svg = document.querySelector('#graph');
let box=d3.select(graph_svg);

let svg={
  box:undefined,
  node:undefined,
  link:undefined,
  animate_link:undefined,
  arrow:undefined,
  label:undefined,
  label_bg:undefined
}

let data={
  nodes:undefined,
  links:undefined
}

let topo;
let force;


let w = window.innerWidth;
let h = window.innerHeight;

let categories_visible = false;

let primary_nodes = {
  p0: true,
  p1: true
}
let primary_node_str = { p0: "coffee", p1: "cancer" };

let intermediary_str = ['loop', 'mediating', 'confounding'];

let mode='topological';
let mode_transition=false;





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
let node_lists;
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
  .then((json) => {
    nodes = json.nodes;
    link_lists = json.links_categorized;
    

    init(link_lists, nodes);
    graph_input = generate_graph_input();
    topo=new Topological(graph_input.nodes, graph_input.links, graph_svg);
    force=new Force(graph_input.nodes, graph_input.links, graph_svg);
    graph = mode=='topological'?topo:force;
  });

function init(link_lists, nodes) {


  // for(let list of link_lists){
  //   for(let link of list){
  //     link.source=nodes.find(node=>node.val==link.source);
  //     link.target=nodes.find(node=>node.val==link.target);
  //   }
  // }




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
      main.dataset[select.name]=select.value;
      graph_svg.dataset[select.name]=select.value;

      if(select.name=='graph_type'){
        mode_transition=true;
        if(mode=='topological'){
          mode='force';
          graph=force;
          graph.update(graph_input.nodes, graph_input.links)
        }else if(mode=='force'){
          graph.simulation.stop();
          mode='topological';

          map['p0_downstream'].count = 0;
          map['p0_downstream'].field.querySelector('input[type="range"]').value=0;
          map['p0_downstream'].field.querySelector('.count').innerText=0;
          map['p1_upstream'].count = 0;
          map['p1_upstream'].field.querySelector('input[type="range"]').value=0;
          map['p1_upstream'].field.querySelector('.count').innerText=0;
          graph_input = generate_graph_input();

          graph=topo;
          graph.update(graph_input.nodes, graph_input.links)
        }
      }

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

  set_up_d3();

}


function set_up_d3(){
  svg.box=d3.select(graph_svg);

  svg.link = svg.box.append("g")
      .attr('class', 'link-lines')
      .attr("stroke", "black")
      .attr("stroke-opacity", 1)
      .attr("stroke-width", 1)
      .attr("stroke-linecap", "round")
      .attr("vector-effect", "non-scaling-stroke")
      .selectAll("path")

    svg.animate_link = svg.box.append("g")
      .attr('class', 'animate')
      .attr("stroke", "black")
      .attr("stroke-opacity", 1)
      .attr("stroke-width", 1)
      .attr("stroke-linecap", "round")
      .attr("vector-effect", "non-scaling-stroke")
      .selectAll("path")


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
    
    svg.label_bg=svg.box
      .append("g")
      .attr('class','node-label-bgs')
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

    svg.animate_link = svg.box.append("g")
      .attr('class', 'animate')
      .attr("stroke", "black")
      .attr("stroke-opacity", 1)
      .attr("stroke-width", 1)
      .attr("stroke-linecap", "round")
      .attr("vector-effect", "non-scaling-stroke")
      .selectAll("path")


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
    
    svg.label_bg=svg.box
      .append("g")
      .attr('class','node-label-bgs')
      .selectAll("rect")

    svg.label = svg.box
      .append('g')
      .attr('class', 'node-labels')
      .selectAll('text')
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




const Topological = class {
  constructor(nodes, links, svg) {

    this.nodes = nodes;
    this.links = links;

    this.spacer = 18;

    this.x_margin="6";
    this.y_margin="0";

    


    if(mode=='topological') this.update(nodes, links);




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

    refresh_data(nodes,links);

    this.nodes = data.nodes;
    this.links = data.links;
    this.index_by_group(this.nodes);

    // console.log('update!',data);

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

    svg.link = svg.link
      .data(data.links, d => d.source + '-' + d.target)
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


    svg.arrow = svg.arrow
      .data(data.links, d => d.source + '-' + d.target)
      .join(enter => enter.append('path')
        .attr('d','M0.950256 1L2.95026 3L4.95026 5L0.950256 9')
        .attr('id',d=>d.type=='primary'?'arrow-primary':'')
        .style('transform',d=>`translate(${d.point.x}px,${d.point.y}px) rotate(${d.point.angle + 180}deg) translateX(-2px) translateY(-5px)`),
        update=>update
        .style('transform',d=>`translate(${d.point.x }px,${d.point.y}px) rotate(${d.point.angle + 180}deg) translateX(-2px) translateY(-5px)`)
        )
  

    svg.node = svg.node
      .data(data.nodes, (d) => d.val)
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

    
          
    


    svg.label = svg.label
      .data(data.nodes, (d) => d.val)
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
    
    svg.label_bg=svg.label_bg
      .data(data.nodes,(d)=>d.val)
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




    


  }

}



const Force= class {
  constructor(nodes,links,svg){

    this.x_margin="6";
    this.y_margin="0";

    this.type_colors=type_colors

    //initiate simulation with settings ----------------

    this.forceNode = d3.forceManyBody();
    this.forceNode.strength(-2000);
    this.forceLink = d3.forceLink().id(d=>d.val);
    this.forceLink.strength(2);
    this.forceCollide=d3.forceCollide(10)
    this.forceLink.distance(()=>{ return 140; });
    this.downstream_p1=this.isolate(d3.forceX(w*2), function(d) {
      return d.downstream_p1; 
    }).strength(0.8);
    this.upstream_p0=this.isolate(d3.forceX(w*-2), function(d) {
      return d.upstream_p0; 
    }).strength(0.8);
    
    // this.force_center=d3.forceCenter([w/2,h/2]);

    this.simulation = d3.forceSimulation()
      .force("link", this.forceLink)
      .force("charge", this.forceNode)
      .force("collide",this.forceCollide)
      .force("upstream_p0",this.upstream_p0)
      .force("downstream_p1",this.downstream_p1)
      .on("tick", this.ticked.bind(this));
      
    
    
    //initiate groups for graph elements -----------------




    

    if(mode=='force') this.update(nodes,links);

  
  }

  clicked(event, d) {
    delete d.fx;
    delete d.fy;
    this.simulation.alpha(1).restart();
  }

  drag(simulation) {
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
    if(mode=='force'){
      svg.link
      .attr('d',d=>`M${d.source.x},${d.source.y}A0,0 0 0,1 ${d.target.x},${d.target.y}`)
      .each(function (d,i,nodes) {
        // console.log(d,i,nodes[i])
        d.point=get_halfway_point(nodes[i])
      })

      svg.animate_link
        .style('--str',(d,i,nodes)=>nodes[i].getTotalLength()+'px')
        .attr('d',d=>`M${d.source.x},${d.source.y}A0,0 0 0,1 ${d.target.x},${d.target.y}`)

      
      svg.arrow
        .style('transform',d=>`translate(${d.point.x}px,${d.point.y}px) rotate(${d.point.angle + 180}deg) translateX(-2px) translateY(-5px)`);


      svg.label
        .attr("x", d => d.x)
        .attr("y", d => d.y );
      
      svg.label_bg
        .attr("x", d => d.x )
        .attr("y", d => d.y );

      svg.node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);
    }
    
  }

  update(nodes,links){
    // Make a shallow copy to protect against mutation, while
    // recycling old nodes to preserve position and velocity.

    // const old_node = new Map(this.node.data().map(d => [d.val, d]));
    // const old_link = new Map(this.link.data().map(d => [d.source.val+'-'+d.target.val, d] ));

    // nodes = nodes.map(d => Object.assign(old_node.get(d.val) || {}, d));
    // links = links.map(d =>Object.assign(old_link.get(d.source+'-'+d.target) || {}, d));

    refresh_data(nodes,links);
    


    // console.log(data.nodes,data.links)


    this.simulation
    .force("link", this.forceLink)
    .force("charge", this.forceNode)
    .force("collide",this.forceCollide)
    .force("upstream_p0",this.upstream_p0)
    .force("downstream_p1",this.downstream_p1);

    this.simulation.nodes(data.nodes);
    this.simulation.force("link").links(data.links);
    this.simulation.alpha(1).restart();
    

    svg.link=svg.link
      .data(data.links,d => d.source.val+'-'+d.target.val)
      .join('path')
      .attr('class',(d)=>`${d.type} ${d.sign}`);

    svg.animate_link=svg.animate_link
      .data(data.links,d => d.source.val+'-'+d.target.val)
      .join('path')
      .attr('class',(d)=>`${d.type} ${d.sign}`);

    svg.arrow = svg.arrow
      .data(data.links, d => d.source + '-' + d.target)
      .join(enter => enter.append('path')
        .attr('d','M0.950256 1L2.95026 3L4.95026 5L0.950256 9')
        .attr('id',d=>d.type=='primary'?'arrow-primary':''))

    svg.node=svg.node
      .data(data.nodes,(d)=>d.val)
      .join(enter=>enter.append('circle')
        .attr("r", 3)
        .attr('data-val',(d)=>d.val)
        .attr('class',(d)=>`node ${d.primary?'primary':''}`)
        .each(function(d){
          if(d.val=='coffee'){
            d.fx=w/4;
            d.fy=h/4;
          }else if(d.val=='cancer'){
            d.fx=w/4*3;
            d.fy=h/4*3;
          }
        })
        .call(this.drag(this.simulation))
        .on('click',this.clicked.bind(this)),
        update=>update.each(function(d){
          if(mode_transition){
            if(d.val=='coffee'){
              d.fx=w/4;
              d.fy=h/4;
            }else if(d.val=='cancer'){
              d.fx=w/4*3;
              d.fy=h/4*3;
            }
          }
        }))


    
    svg.label=svg.label
        .data(data.nodes,(d)=>d.val)
        .join(enter=>enter.append('text')
          .attr('class',(d)=>`noselect ${d.primary?'primary':''} ${d.type?'has-type':''}`)
          .attr('data-val',(d)=>d.val)
          .text((d)=>d.val)
          .call(this.drag(this.simulation))
          .each(function(d) { d.bbox = this.getBBox(); })
          .on('click',this.clicked.bind(this)))

    
    svg.label_bg=svg.label_bg
      .data(data.nodes,(d)=>d.val)
      .join(enter=>enter.append('rect')
        .attr('class',(d)=>d.primary?'primary':'')
        .style('fill',(d)=>d.type?`var(--cat-${d.type})`:'none')
        .style('opacity',1)
        .attr('rx',d => d.bbox.height/2)
        .attr('ry',d => d.bbox.height/2)
        .attr('data-type',(d)=>d.type)
        .attr("width", d => d.bbox.width + this.x_margin*2 + 'px')
        .attr("height", d => d.bbox.height + this.y_margin*2 + 'px')
        .call(this.drag(this.simulation))
      )
    
    mode_transition=false;

          
            
  }

  updateSim(setting,value){
    switch(setting){
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

    force.initialize=(nodes)=>{
      return initialize.call(force, nodes.filter(filter)); 
    }
    return force;
  }


}


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


function refresh_data(nodes,links){
  // Make a shallow copy to protect against mutation, while
    // recycling old nodes to preserve position and velocity.

  const old_node = new Map(svg.node.data().map(d => [d.val, d]));
  const old_link = new Map(svg.link.data().map(d => [d.source.val+'-'+d.target.val, d] ));

  data.nodes = nodes.map(d => Object.assign(old_node.get(d.val) || {}, d));
  data.links =  links.map(d =>Object.assign(old_link.get(d.source+'-'+d.target) || {}, d));
}