import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";


let main=document.querySelector('main');
let graph_svg=document.querySelector('#graph');

let w=window.innerWidth;
let h=window.innerHeight;

let primary_nodes=["coffee","cancer"];

let type_colors={
  disease:'#FEB3FF',
  treatment:'#7EF5CB',
  genetic:'#FFFF00',
  behavior:'#FFA07A',
  symptom:'#cba1ff'
}

let map={};
let force_input;
let link_lists;
let nodes;


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


fetch('data/dag-link-data.json')
.then((response) => response.json())
.then((data) => {
    nodes=data.nodes;
    link_lists=data.links_categorized;
 
    init(link_lists,nodes);
    force_input=generate_force_input();

    force=new Force(force_input.nodes,force_input.links,graph_svg);

});

function init(link_lists,nodes){
  let keys=Object.keys(link_lists);

  for(let key of keys){
    let parts=key.split('_')
    map[key]={
      count:link_lists[key].length
    };

    if(parts[0]!=='primary'){
      map[key].field=parts.length>1?document.querySelector(`#${parts[0]} div[data-name="${parts[1]}"]`):document.querySelector(`div[data-name="${parts[0]}"]`)
      let range=map[key].field.querySelector('input');
      let counter=map[key].field.querySelector('.count');
      range.max=link_lists[key].length;
      range.value=link_lists[key].length;
      counter.innerText=link_lists[key].length;


      range.addEventListener('input',function(){
        counter.innerText=range.value;
      })

      range.addEventListener('change',function(){
        counter.innerText=range.value;
        map[key].count=parseInt(range.value);
        force_input=generate_force_input();
        force.update(force_input.nodes,force_input.links)
      })
    }
    
    

  }

  let key_section=document.querySelector('#key')
  console.log(Object.entries(type_colors));
  for(let [type,color] of Object.entries(type_colors)){
    let row=document.createElement('div')
    let swatch=document.createElement('div');
    let text=document.createElement('span');
    
    row.classList.add('row-wrap')
    row.classList.add('color')
    row.style.setProperty('--color',color)
    text.innerText=type;
    swatch.classList.add('swatch')
    row.appendChild(swatch)
    row.appendChild(text);
    key_section.appendChild(row);
  }
  key_section.querySelector('input[type="checkbox').addEventListener('click',function(){
    if(key_section.querySelector('input[type="checkbox').checked) main.classList.add('see-categories')
    else  main.classList.remove('see-categories')
  })


  document.querySelectorAll('#graph-settings .row-wrap').forEach((field)=>{
    let range=field.querySelector('input[type="range"]');
    let counter=field.querySelector('.count');

    range.addEventListener('change',function(){
      counter.innerText=range.value;
      force.updateSim(field.dataset.name,range.value);
    })


  })
}


function generate_force_input(){

  // let nodes=[];
  //slice each array according to the map count for it
  //combine all arrays into a composite
  let links=[];
  
  for(let [key,list] of Object.entries(link_lists)){
    let addition=[];
    if(list[0] && "links" in list[0]){
      for(let i=0;i<map[key].count;i++){
        let group=list[i]
        addition=addition.concat(group.links)
      }
    }else{
      addition=list.slice(0,map[key].count);
    }
    
    links=links.concat(addition);
  }

  let nodes_relevant=nodes.filter(node=>{
    return links.find(a=>{
      return a.source==node.val||a.target==node.val;
    })||node.primary;
  })

  
  return {
    nodes:nodes_relevant,
    links:links
  }

  
}




const Force= class {
  constructor(nodes,links,svg){

    this.x_margin="5";
    this.y_margin="2";

    this.type_colors=type_colors

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
    .attr('class','link-lines')
      .attr("stroke", "black")
      .attr("stroke-opacity", 1)
      .attr("stroke-width", 1)
      .attr("stroke-linecap", "round")
      .attr("vector-effect", "non-scaling-stroke")
      .selectAll("polyline")

    this.label_bg=this.box
      .append("g")
      .attr('class','node-label-bgs')
      .selectAll("rect")

    this.node = this.box
      .append('g')
        .attr('class','node-circles')
        .attr("fill", "currentColor")
        .attr("stroke", "#fff")
        .attr("stroke-opacity", 1)
        .attr("stroke-width", 1)
      .selectAll("circle")
  
    this.label = this.box
      .append('g')
      .attr('class','node-labels')
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

    this.label
      .attr("x", d => d.x)
      .attr("y", d => d.y );
    
    this.label_bg
      .attr("x", d => d.x - this.x_margin * (d.primary?2.5:3) )
      .attr("y", d => d.y - this.y_margin * (d.primary?7:6)  );

    this.node
      .attr("cx", d => d.x)
      .attr("cy", d => d.y);
  }

  update(nodes,links){
    // Make a shallow copy to protect against mutation, while
    // recycling old nodes to preserve position and velocity.
    console.log(nodes.find(a=>a.val=='cancer'))

    const old_node = new Map(this.node.data().map(d => [d.val, d]));
    const old_link = new Map(this.link.data().map(d => [d.source.val+'-'+d.target.val, d] ));

    nodes = nodes.map(d => Object.assign(old_node.get(d.val) || {}, d));
    links = links.map(d =>Object.assign(old_link.get(d.source+'-'+d.target) || {}, d));


    
    // console.log(nodes,links)
    this.simulation.nodes(nodes);
    this.simulation.force("link").links(links);
    this.simulation.alpha(1).restart();
    
    this.link=this.link
      .data(links,d => d.source.val+'-'+d.target.val)
      .join('polyline')
      .attr('marker-mid',(d)=>`url(#arrow${d.type?'-primary':''})`)
      .attr('class',(d)=>d.type);
      
    console.log(
      nodes.find(a=>a.val=='cancer'),
      nodes.find(a=>a.val=='genotype')
      )
    this.node=this.node
      .data(nodes,(d)=>d.val)
      .join(enter=>enter.append('circle')
        .attr("r", 3)
        .attr('data-val',(d)=>d.val)
        .attr('class',(d)=>`node ${d.primary?'primary':''}`)
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
        .data(nodes,(d)=>d.val)
        .join(enter=>enter.append('text')
          .attr('class',(d)=>`noselect ${d.primary?'primary':''} ${d.type?'has-type':''}`)
          .attr('data-val',(d)=>d.val)
          .text((d)=>d.val)
          .call(this.drag(this.simulation))
          .each(function(d) { d.bbox = this.getBBox(); })
          .on('click',this.clicked.bind(this)))

    
    this.label_bg=this.label_bg
      .data(nodes,(d)=>d.val)
      .join(enter=>enter.append('rect')
        .style('fill',(d)=>d.type?this.type_colors[d.type]:'none')
        .style('opacity',0.6)
        .attr('rx',d => d.bbox.height/2)
        .attr('ry',d => d.bbox.height/2)
        .attr('data-type',(d)=>d.type)
        .attr("width", d => d.bbox.width + 6 * this.x_margin)
        .attr("height", d => d.bbox.height + 2 * this.y_margin)
        .call(this.drag(this.simulation))
      )
      
      
          //   .style("fill", "black")
          //   .style("opacity", "0.5")
          
            
  }

  updateSim(setting,value){
    this.simulation.force(setting).strength(value);
    this.simulation.alpha(1).restart();
  }


}





