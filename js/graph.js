import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

let nodes=[];
let links;

let nodeSvg=document.querySelector('#nodes');
let labels=document.querySelector('#labels');
let linkSvg=document.querySelector('#links');

let w=window.innerWidth;
let h=window.innerHeight;

setSize();
window.addEventListener('resize',setSize);

function setSize(){
    w=window.innerWidth;
    h=window.innerHeight;
    d3.select(nodeSvg).attr('width',w+'px');
    d3.select(nodeSvg).attr('height',h+'px');
    d3.select(nodeSvg).attr('viewBox',`${0 - w/2} ${0 - h/2} ${w} ${h}`);

    d3.select(linkSvg).attr('width',w+'px');
    d3.select(linkSvg).attr('height',h+'px');
    d3.select(linkSvg).attr('viewBox',`${0 - w/2} ${0 - h/2} ${w} ${h}`);

    d3.select(labels).attr('width',w+'px');
    d3.select(labels).attr('height',h+'px');
    d3.select(labels).attr('viewBox',`${0 - w/2} ${0 - h/2} ${w} ${h}`);
}



fetch('data/worst_case_links.json')
.then((response) => response.json())
.then((data) => {
    let cancerLinks=data.links.filter(a=>a.source=="cancer"||a.target=="cancer");
    let coffeeLinks=data.links.filter(a=>a.source=="coffee"||a.target=="coffee");

    // let primary=data.links.filter(a=>a.source=='coffee'||a.source=='cancer'||a.target=='coffee'||a.target=='cancer')
   
    let nodeLog=[];


    // must check to see if any node is connected to both coffee and cancer

    for(let link of data.links){
      if(!nodeLog.find(a=>a.name==link.target)) nodeLog.push({name:link.target});
      if(!nodeLog.find(a=>a.name==link.source)) nodeLog.push({name:link.source});

      if(link.source=='coffee'||link.source=='coffee'){
        let node=nodeLog.find(a=>a.name==link.target);
        node[link.source]=true;
      }else if(link.target=='coffee'||link.target=='cancer'){
        let node=nodeLog.find(a=>a.name==link.source);
        node[link.target]=true;
      }
    }

   let mediating=nodeLog.filter(a=>a.coffee&&a.cancer);

    // let mediating=nodeLog.filter(a=>a.source&&a.target);
    // let conflating=nodeLog.filter(a=>{
    //   let withThisSource=data.links.filter(x=>x.source==a.name);
    //   let withValidTarget=withThisSource.filter(x=> (x.source=="coffee"||mediating.find(y=>x.source==y.name))&&(x.target=="cancer"||mediating.find(y=>x.target==y.name)) );
    //   return withValidTarget.length>0;
    // });
    // console.log(mediating,conflating);
    


    let sourceUpstream=data.links.filter(a=>a.target=='coffee');
    let targetDownstream=data.links.filter(a=>a.source=='cancer');
    
    let filteredLinks=data.links.filter(link=>{
      return mediating.find(node=>node.name==link.target||node.name==link.source);
    });

    let mediatingAndUpstream=data.links.filter(link=>{
      return mediating.find(node=>node.name==link.target||node.name==link.source)
      &&link.target=='coffee'
    });

    let mediatingAndDownstream=data.links.filter(link=>{
      return mediating.find(node=>node.name==link.target||node.name==link.source)
      &&link.source=='cancer'
    });

    mediatingAndDownstream.forEach((link)=>{
      if(sourceUpstream.find(a=>a.name==link.target)) console.log('loop!',link.target)
    })

    

    console.log(
      'upstream:',sourceUpstream,
      '\ndownstream:',targetDownstream,
      '\nmediating:',filteredLinks,
      '\nmediating and upstream:',mediatingAndUpstream,
      '\nmediating and downstream:',mediatingAndDownstream
      )

    // console.log(sourceUpstream,targetDownstream);
    // links=sourceUpstream.concat(targetDownstream);

    // links=filteredLinks;
    
    links=cancerLinks.slice(0,20).concat(coffeeLinks.slice(0,20))
    // links=data.links.slice(0,20);
    links=links.map(a=>{
      return  {
        "source":a.source,
        "target":a.target,
        "type":'relation'
      }
    })
    links.unshift({
      "source":"coffee",
      "target":"cancer",
      "type":"relation main"
    })

    for(let link of links){
        if (!nodes.find(a=>a.val==link.source)) nodes.push({val:link.source});
        if (!nodes.find(a=>a.val==link.target)) nodes.push({val:link.target});
    }
    console.log(links,nodes)

    force(
        {
        nodes:nodes,
        links:links,
        },
        {
            nodeSvg:nodeSvg,
            labels:labels,
            linkSvg:linkSvg
        },
        {
            nodeId: d => d.val,
            width:w,
            height:h,
            nodeStrength:-1200,
            linkStrength:1,
            nodeTitle:d=>d.val
            // invalidation // a promise to stop the simulation when the cell is re-run
          }
    );

    





  });




function force({
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
    const LS = d3.map(links, linkSource);
    const LT = d3.map(links, linkTarget);
    if (nodeTitle === undefined) nodeTitle = (_, i) => N[i];
    const T = nodeTitle == null ? null : d3.map(nodes, nodeTitle);
    const G = nodeGroup == null ? null : d3.map(nodes, nodeGroup);
    const W = typeof linkStrokeWidth !== "function" ? null : d3.map(links, linkStrokeWidth);
  
    // Compute default domains.
    if (G && nodeGroups === undefined) nodeGroups = d3.sort(G);
  
    // Construct the scales.
    const color = nodeGroup == null ? null : d3.scaleOrdinal(nodeGroups, colors_def);
  
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
  
  
    let nodeBox = d3.select(nodeSvg);
    let labelBox = d3.select(labels);
    console.log(dom)
    let linkBox = d3.select(linkSvg);
  
  
    linkBox.selectAll('line').remove()
  
  
    const link = linkBox.append("g")
        .attr("stroke", linkStroke)
        .attr("stroke-opacity", linkStrokeOpacity)
        .attr("stroke-width", typeof linkStrokeWidth !== "function" ? linkStrokeWidth : null)
        .attr("stroke-linecap", linkStrokeLinecap)
        .attr("vector-effect", "non-scaling-stroke")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr('class',(d)=>d.type);

      const link2 = linkBox.append("g")
      .attr('class','animate')
      .attr("stroke", linkStroke)
      .attr("stroke-opacity", linkStrokeOpacity)
      .attr("stroke-width", typeof linkStrokeWidth !== "function" ? linkStrokeWidth : null)
      .attr("stroke-linecap", linkStrokeLinecap)
      .attr("vector-effect", "non-scaling-stroke")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr('class',(d)=>d.type);
  
    if (W) link.attr("stroke-width", ({index: i}) => W[i]);
  
  
    nodeBox.selectAll('circle').remove();
  
    const node = nodeBox.append("g")
        .attr("fill", nodeFill)
        .attr("stroke", nodeStroke)
        .attr("stroke-opacity", nodeStrokeOpacity)
        .attr("stroke-width", nodeStrokeWidth)
      .selectAll("circle")
      .data(nodes)
      .join("circle")
        .attr("r", nodeRadius)
        .attr('class','node')
        .call(drag(simulation))
    


  
    labelBox.selectAll('text').remove();
  
    const labelEls = labelBox
        .selectAll('text')
        .data(nodes)
        .join('text')
        .attr('class','noselect')
        .text((d)=>d.val)
        .call(drag(simulation));

  
  
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

        link2
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y)
        .style('--str',(d,i,nodes)=>nodes[i].getTotalLength());

        labelEls
        .attr("x", d => d.x)
        .attr("y", d => d.y );

        node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);
    }
  
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
        event.subject.fx = null;
        event.subject.fy = null;
      }
  
      return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }
  
    // return Object.assign(svg.node(), {scales: {color}});
  }


