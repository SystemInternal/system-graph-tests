import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";



let nodeSvg=document.querySelector('#nodes');
let labels=document.querySelector('#labels');
let linkSvg=document.querySelector('#links');

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
    w=window.innerWidth;
    h=window.innerHeight;
    d3.select(nodeSvg).attr('width',w+'px');
    d3.select(nodeSvg).attr('height',h+'px');
    d3.select(nodeSvg).attr('viewBox',`0 0 ${w} ${h}`);

    d3.select(linkSvg).attr('width',w+'px');
    d3.select(linkSvg).attr('height',h+'px');
    d3.select(linkSvg).attr('viewBox',`0 0 ${w} ${h}`);

    d3.select(labels).attr('width',w+'px');
    d3.select(labels).attr('height',h+'px');
    d3.select(labels).attr('viewBox',`0 0 ${w} ${h}`);
}


function init(node_lists,links){
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
        console.log(force_input);
        force.update(force_input.nodes,force_input.links)
      })
    }
    



  }
}


function generate_force_input(){

  let nodes=[];
  //slice each array according to the map count for it
  //combine all arrays into a composite
  for(let [key,list] of Object.entries(node_lists)) nodes=nodes.concat(list.slice(0,map[key].count));

  //run a filter to get rid of duplicates
  nodes=nodes.filter((node,i)=>nodes.indexOf(node) == i);

  
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

    force=new Force(force_input.nodes,force_input.links,nodeSvg);

    // force(
    //     {
    //     nodes:force_input.nodes,
    //     links:force_input.links,
    //     },
    //     {
    //         nodeSvg:nodeSvg,
    //         labels:labels,
    //         linkSvg:linkSvg
    //     },
    //     {
    //         nodeId: d => d.val,
    //         width:w,
    //         height:h,
    //         nodeStrength:-1000,
    //         linkStrength:1.5,
    //         nodeTitle:d=>d.val
    //         // invalidation // a promise to stop the simulation when the cell is re-run
    //       }
    // );

    





  });



const Force= class {
  constructor(nodes,links,svg){

    this.forceNode = d3.forceManyBody();
    this.forceLink = d3.forceLink(links).id(({index: i}) => d3.map(nodes, (d) => d.val)[i]);
    this.forceNode.strength(-1000);
    this.forceLink.strength(1.5);
    this.forceLink.distance(()=>{ return 140; });

    this.simulation = d3.forceSimulation(nodes)
      .force("link", this.forceLink)
      .force("charge", this.forceNode)
      .force("x", d3.forceX())
      .force("y", d3.forceY())
      .on("tick", this.ticked.bind(this));
    
    this.box = d3.select(svg);
    this.box.selectAll('line').remove();
    this.link=this.box.append("g")
        .attr("stroke", "black")
        .attr("stroke-opacity", 1)
        .attr("stroke-width", 1)
        .attr("stroke-linecap", "round")
        .attr("vector-effect", "non-scaling-stroke")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr('class',(d)=>d.type)

    this.node = this.box
      .append('g')
        .attr("fill", "currentColor")
        .attr("stroke", "#fff")
        .attr("stroke-opacity", 1)
        .attr("stroke-width", 1)
      .selectAll("circle")
      .data(nodes)
      .join("circle")
        .attr("r", 3)
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
        .on('click',this.clicked.bind(this))
    
      this.box.selectAll('text').remove();

      this.label = this.box
          .selectAll('text')
          .data(nodes)
          .join('text')
          .attr('class','noselect')
          .text((d)=>d.val)
          .call(this.drag(this.simulation))
          .on('click',this.clicked.bind(this))
  
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
  
    function grid(val){
      return 36*Math.floor(val/36);
    }
    
    this.link
    .attr("x1", d => d.source.x)
    .attr("y1", d => d.source.y)
    .attr("x2", d => d.target.x)
    .attr("y2", d => d.target.y);

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

    // const old = new Map(this.node.data().map(d => [d.id, d]));
    // nodes = nodes.map(d => Object.assign(old.get(d.val) || {}, d));
    // links = links.map(d => Object.assign({}, d));

    this.simulation.nodes(nodes);
    this.simulation.force("link").links(links);
    this.simulation.alpha(1).restart();

    this.node = this.node
      .data(nodes)
      .join("circle")
        .attr("r", 3)
        .attr('class',(d)=>`node ${d.val=='coffee'||d.val=='cancer'?'primary':''}`)
        .call(this.drag(this.simulation))
        .on('click',this.clicked.bind(this))


      // .join(enter =>{ 
      //     enter.append("circle")
      //     .attr("r", 3)
      //     .attr('class',(d)=>`node ${d.val=='coffee'||d.val=='cancer'?'primary':''}`)
      //     .each(function(d){
      //       if(d.val=='coffee'){
      //         d.fx=w/3;
      //         d.fy=h/3;
      //       }else if(d.val=='cancer'){
      //         d.fx=w/3*2;
      //         d.fy=h/3*2;
      //       }
      //     })
      //     .call(this.drag(this.simulation))
      //     .on('click',this.clicked.bind(this))
      //   }
      // );
        
      this.label = this.label
          .data(nodes)
          .join('text')
          .attr('class','noselect')
          .text((d)=>d.val)
          .call(this.drag(this.simulation))
          .on('click',this.clicked.bind(this))


          // .join('text')
          // .attr('class','noselect')
          // .text((d)=>d.val)
          // .call(this.drag(this.simulation))
          // .on('click',this.clicked.bind(this))


      this.link = this.link
      .data(links)
      .join("line")
      .attr('class',(d)=>d.type);

  }
}



function force_old({
    nodes, // an iterable of node objects (typically [{id}, …])
    links, // an iterable of link objects (typically [{source, target}, …])
  },
  {
    nodeSvg,
    labels,
    linkSvg,
  },
  {
    nodeId = d => d.val, // given d in nodes, returns a unique identifier (string)
    nodeGroup, // given d in nodes, returns an (ordinal) value for color
    nodeGroups, // an array of ordinal values representing the node groups
    nodeTitle, // given d in nodes, a title string
    nodeFill = "currentColor", // node stroke fill (if not using a group color encoding)
    nodeStroke = "#fff", // node stroke color
    nodeStrokeWidth = 0, // node stroke width, in pixels
    nodeStrokeOpacity = 1, // node stroke opacity
    nodeRadius = 3, // node radius, in pixels
    nodeStrength,
    linkSource = ({source}) => source, // given d in links, returns a node identifier string
    linkTarget = ({target}) => target, // given d in links, returns a node identifier string
    linkStroke = "black", // link stroke color
    linkStrokeOpacity = 1, // link stroke opacity
    linkStrokeWidth = 1, // given d in links, returns a stroke width in pixels
    linkStrokeLinecap = "round", // link stroke linecap
    linkStrength,
    colors_def = d3.schemeTableau10, // an array of color strings, for the node groups
    width = w, // outer width, in pixels
    height = h, // outer height, in pixels
    invalidation // when this promise resolves, stop the simulation
  } = {}) {
  
  
  
    // Compute values.
    const N = d3.map(nodes, nodeId);
    if (nodeTitle === undefined) nodeTitle = (_, i) => N[i];

  
  

  
    // Construct the forces.
    const forceNode = d3.forceManyBody();
    const forceLink = d3.forceLink(links).id(({index: i}) => N[i]);
    if (nodeStrength !== undefined) forceNode.strength(nodeStrength);
    if (linkStrength !== undefined) forceLink.strength(linkStrength);
    forceLink.distance(()=>{ return 140; });
  
  
    const simulation = d3.forceSimulation(nodes)
        .force("link", forceLink)
        .force("charge", forceNode)
        .force("x", d3.forceX())
        .force("y", d3.forceY())
        .on("tick", ticked);
  
        // simulation.alpha(1).restart();

        
    let box = d3.select(nodeSvg);

  
  
    box.selectAll('line').remove()
  
    
    link = box.append("g")
        .attr("stroke", linkStroke)
        .attr("stroke-opacity", linkStrokeOpacity)
        .attr("stroke-width", typeof linkStrokeWidth !== "function" ? linkStrokeWidth : null)
        .attr("stroke-linecap", linkStrokeLinecap)
        .attr("vector-effect", "non-scaling-stroke")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr('class',(d)=>d.type)
      


  

  
  
    box.selectAll('circle').remove();
  
    node = box
      .append('g')
        .attr("fill", nodeFill)
        .attr("stroke", nodeStroke)
        .attr("stroke-opacity", nodeStrokeOpacity)
        .attr("stroke-width", nodeStrokeWidth)
      .selectAll("circle")
      .data(nodes)
      .join("circle")
        .attr("r", nodeRadius)
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
        .call(drag(simulation))
        .on('click',click)
    

    
  
    box.selectAll('text').remove();
  
    label = box
        .selectAll('text')
        .data(nodes)
        .join('text')
        .attr('class','noselect')
        .text((d)=>d.val)
        .call(drag(simulation))
        .on('click',click)

      function click(event, d) {
        delete d.fx;
        delete d.fy;
        simulation.alpha(1).restart();
      }
    
      
  
  
    // Handle invalidation.
    if (invalidation != null) invalidation.then(() => simulation.stop());
  
  
  
    function ticked() {
  
      function grid(val){
        return 36*Math.floor(val/36);
      }

        link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

        label
        .attr("x", d => d.x)
        .attr("y", d => d.y );

        node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);
    }

    //----
  
    function drag(simulation) {
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
  
    // return Object.assign(svg.node(), {scales: {color}});
  }




