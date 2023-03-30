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
