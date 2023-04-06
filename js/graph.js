import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";



let graph_svg=document.querySelector('#graph');

let w=window.innerWidth;
let h=window.innerHeight;



let map={};
let force_input;
let node_lists;
let links;

// let link;
// let node;
// let label;

let force;



setSize();
window.addEventListener('resize',setSize);

function setSize(){
    let sidebar=parseInt(getComputedStyle(document.body).getPropertyValue('--sidebar').replace('px','')); 
    w=window.innerWidth - sidebar + 20;
    h=window.innerHeight - 40;
    d3.select(graph_svg).attr('width',w+'px');
    d3.select(graph_svg).attr('height',h+'px');
    d3.select(graph_svg).attr('viewBox',`0 0 ${w} ${h}`);

}


function init(node_lists,links){
  let main=document.querySelector('main');

  let keys=Object.keys(node_lists);
  for(let key of keys){
    // console.log(key);
    let parts=key.split('_')
    map[key]={
      count:node_lists[key].length
    };
    if(key!=='coffee'&&key!=='cancer'){
      map[key].field=parts.length>1?document.querySelector(`#${parts[0]} div[data-name="${parts[1]}"]`):document.querySelector(`div[data-name="${parts[0]}"]`)
      let range=map[key].field.querySelector('input');
      let counter=map[key].field.querySelector('.count');
      range.max=node_lists[key].length;
      range.value=node_lists[key].length;
      counter.innerText=node_lists[key].length;
      range.addEventListener('change',function(){
        counter.innerText=range.value;
        map[key].count=range.value;
        force_input=generate_force_input();
        // console.log(force_input);
        force.update(force_input.nodes,force_input.links)
      })
    }else{
      let checkbox=document.querySelector(`#${key} input[type="checkbox"]`);

      // function resetField(name,on){
      //   map[name+'upstream'].count=on?node_lists[key].length:0;
      // }

      checkbox.addEventListener('change',function(){
        if(checkbox.checked){
          map[key].count=1;
          map[key+'_upstream'].count=node_lists[key+'_upstream'].length;
          map[key+'_upstream'].field.querySelector('input').value=node_lists[key+'_upstream'].length;
          map[key+'_upstream'].field.querySelector('.count').innerText=node_lists[key+'_upstream'].length;
          map[key+'_downstream'].count=node_lists[key+'_upstream'].length;
          map[key+'_downstream'].field.querySelector('.count').innerText=node_lists[key+'_downstream'].length;
          map[key+'_downstream'].field.querySelector('input').value=node_lists[key+'_downstream'].length;
          main.classList.remove('topic-view');
        }else{
          map[key].count=0;
          map[key+'_upstream'].count=0;
          map[key+'_upstream'].field.querySelector('input').value=0;
          map[key+'_upstream'].field.querySelector('.count').innerText=0;

          map[key+'_downstream'].count=0;
          map[key+'_downstream'].field.querySelector('input').value=0;
          map[key+'_downstream'].field.querySelector('.count').innerText=0;


          main.classList.add('topic-view');
          main.dataset.viewing=key=="coffee"?"cancer":"coffee";
        }
        
      
        force_input=generate_force_input();
        force.update(force_input.nodes,force_input.links);
      })
    }

  }


  document.querySelectorAll('#graph-settings .row-wrap').forEach((field)=>{
    let range=field.querySelector('input[type="range"]');
    let counter=field.querySelector('.count');

    range.addEventListener('change',function(){
      counter.innerText=range.value;
      force.updateSim(field.dataset.name,range.value);
      // map[key].count=range.value;
      // force_input=generate_force_input();
      // // console.log(force_input);
      // force.update(force_input.nodes,force_input.links)
    })


  })
}


function generate_force_input(){

  let nodes=[];
  //slice each array according to the map count for it
  //combine all arrays into a composite
  for(let [key,list] of Object.entries(node_lists)) nodes=nodes.concat(list.slice(0,map[key].count));

  
  //run a filter to get rid of duplicates
  nodes=nodes.filter((node,i)=>nodes.findIndex(a=>a.val==node.val) == i);
  
  //use that node list to filter the links
  let links_relevant=links.filter(link=>nodes.find(node=>{
    if(typeof link.source=='string') return node.val==link.source
    else return node.val==link.source.val
  })&&nodes.find(node=>{
    if(typeof link.target=='string') return node.val==link.target
    else return node.val==link.target.val
  }));
  return {
    nodes:nodes,
    links:links_relevant
  }

  
}

fetch('data/dag-data.json')
.then((response) => response.json())
.then((data) => {
    node_lists=data.nodes_separated;
    links=data.links;

    init(node_lists,links);
    force_input=generate_force_input();

    force=new Force(force_input.nodes,force_input.links,graph_svg);

  });



const Force= class {
  constructor(nodes,links,svg){

    //initiate simulation with settings ----------------

    this.forceNode = d3.forceManyBody();
    this.forceNode.strength(-2000);
    this.forceLink = d3.forceLink().id(d=>d.val);
    this.forceLink.strength(2);
    this.forceLink.distance(()=>{ return 140; });

    this.simulation = d3.forceSimulation()
      .force("link", this.forceLink)
      .force("charge", this.forceNode)
      .force("x", d3.forceX())
      .force("y", d3.forceY())
      .on("tick", this.ticked.bind(this));
    
    
    //initiate groups for graph elements -----------------

    this.box = d3.select(svg);
    this.link=this.box.append("g")
      .attr("stroke", "black")
      .attr("stroke-opacity", 1)
      .attr("stroke-width", 1)
      .attr("stroke-linecap", "round")
      .attr("vector-effect", "non-scaling-stroke")
      .selectAll("polyline")

    this.node = this.box
      .append('g')
        .attr("fill", "currentColor")
        .attr("stroke", "#fff")
        .attr("stroke-opacity", 1)
        .attr("stroke-width", 1)
      .selectAll("circle")
  
    this.label = this.box
      .append('g')
      .selectAll('text')

    this.update(nodes,links);

  
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
    this.link
      .attr('points',d=>{
        let mid={
          x:d.source.x+(d.target.x-d.source.x)/2,
          y:d.source.y+(d.target.y-d.source.y)/2
        }
        return `${d.source.x},${d.source.y} ${mid.x},${mid.y} ${d.target.x},${d.target.y}`;
      })
      // .attr("x1", d => d.source.x)
      // .attr("y1", d => d.source.y)
      // .attr("x2", d => d.target.x)
      // .attr("y2", d => d.target.y);

    this.label
      .attr("x", d => d.x)
      .attr("y", d => d.y );

    this.node
      .attr("cx", d => d.x)
      .attr("cy", d => d.y);
  }

  update(nodes,links){
    // Make a shallow copy to protect against mutation, while
    // recycling old nodes to preserve position and velocity.

    const old = new Map(this.node.data().map(d => [d.val, d]));
    nodes = nodes.map(d => Object.assign(old.get(d.val) || {}, d));
    links = links.map(d => Object.assign({}, d));
    console.log(nodes);

    this.simulation.nodes(nodes);
    this.simulation.force("link").links(links);
    this.simulation.alpha(1).restart();



    this.link=this.link
      .data(links)
      .join('polyline')
      .attr('marker-mid',(d)=>`url(#arrow${d.type?'-primary':''})`)
      .attr('class',(d)=>d.type);
      
    
    this.node=this.node
      .data(nodes)
      .join(enter=>enter.append('circle')
        .attr("r", 3)
        .attr('data-val',(d)=>d.val)
        .attr('class',(d)=>`node ${d.val=='coffee'||d.val=='cancer'?'primary':''}`)
        .each(function(d){
          if(d.val=='coffee'){
            d.fx=w/3;
            d.fy=h/3;
          }else if(d.val=='cancer'){
            d.fx=w/3*2;
            d.fy=h/3*2;
          }
        })
        .call(this.drag(this.simulation))
        .on('click',this.clicked.bind(this)))


    
    this.label=this.label
        .data(nodes)
        .join(enter=>enter.append('text')
          .attr('class',(d)=>`noselect ${d.val=='coffee'||d.val=='cancer'?'primary':''}`)
          .text((d)=>d.val)
          .call(this.drag(this.simulation))
          .on('click',this.clicked.bind(this)))

  }

  updateSim(setting,value){
    this.simulation.force(setting).strength(value);
    this.simulation.alpha(1).restart();
  }


}





