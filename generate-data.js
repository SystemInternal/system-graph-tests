const fs   = require('fs');

generate();

async function generate(){
    let source_data=await generate_from_source();
    // console.log(source_data)
    fs.writeFile('data/dag-data.json', JSON.stringify({
        // nodes:source_data.nodes,
        nodes_separated:source_data.nodes_separated,
        links:source_data.links
    }), err => {
        if (err) {
          console.error(err)
          return
        }
      })
    // console.log(source);
}



//return link and nodelist, one default and one filled in with real info
async function generate_from_source(){
    let links=await find_this('file','data/worst_case_links.json')
    links=links?JSON.parse(links).links:undefined;
    let nodes_default=[];

    
    
    //generate node list and check which primary nodes it is a source/target to
    for(let link of links){
        let source=nodes_default.find(a=>a.val==link.source)
        if (!source){
            nodes_default.push({
                val:link.source,
                coffee_target:link.target=="coffee",
                cancer_target:link.target=="cancer"
            });
        }else{
            if(!source.coffee_target) source.coffee_target=link.target=="coffee"
            if(!source.cancer_target) source.cancer_target=link.target=="cancer"
        }

        let target=nodes_default.find(a=>a.val==link.target);
        if (!target){
            nodes_default.push({
                val:link.target,
                coffee_source:link.source=="coffee",
                cancer_source:link.source=="cancer"
            });
        }else{
            if(!target.coffee_source) target.coffee_source=link.source=="coffee"
            if(!target.cancer_source) target.cancer_source=link.source=="cancer"
        }
    }

    let nodes_separated={
        coffee:[],
        cancer:[],
        coffee_upstream:[],
        coffee_downstream:[],
        cancer_upstream:[],
        cancer_downstream:[],
        confounders:[],
        mediators:[]
    }

    for(let node of nodes_default){
        if(node.val=="cancer"||node.val=="coffee"){
            node.primary=true;
            nodes_separated[node.val].push(node);
        } else if(node.cancer_target&&node.coffee_target){
            //look for nodes which are both a source for coffee as target and a source for cancer as target
            nodes_separated.confounders.push(node);
        }else if(node.coffee_source&&node.cancer_target){
            //look for nodes which are both a target for coffee as source and a source for cancer as target
            nodes_separated.mediators.push(node);
        }else{
            //make a note that all the bidirectional relationships go in upstream
            if(node.coffee_target){
                //look for nodes which are a source for coffee as target
                nodes_separated.coffee_upstream.push(node);
            }else if(node.coffee_source){
                //look for nodes which are a target for coffee as source
                nodes_separated.coffee_downstream.push(node);
            }else if(node.cancer_target){
                nodes_separated.cancer_upstream.push(node);
            }else if(node.cancer_source){
                nodes_separated.cancer_downstream.push(node);
            }

        }
        
    
    
    }


    // nodes_processed=nodes_default.map(node=>{
    //     //look for nodes which are a source for coffee as target
    //     let upstream=node.coffee_target;
       
    //     //look for nodes which are a target for cancer as a source
    //     let downstream=node.cancer_source;
    //     //look for nodes which are both a source for coffee as target and a source for cancer as target
    //     let confounding=node.cancer_target&&node.coffee_target;
    //     //look for nodes which are both a target for coffee as source and a source for cancer as target
    //     let mediating=node.coffee_source&&node.cancer_target;

    //     delete node.coffee_source;
    //     delete node.coffee_target;
    //     delete node.cancer_source;
    //     delete node.cancer_target;

    //     return {
    //         val:node.val,
    //         upstream:upstream?upstream:false,
    //         downstream:downstream?downstream:false,
    //         confounding:confounding?confounding:false,
    //         mediating:mediating?mediating:false,
    //         factor:node.cancer_target==true
    //     }
    // })

    

    // console.log(nodes_separated);

    //in the future, look for indirectly confounding/mediating
        //(if one of the node's targets is a source for cancer or coffee)
    //and also make sure the nodes that they target get included 



    // let nodes_relevant=nodes_processed.filter(node=>node.confounding||node.upstream||node.downstream);

    // nodes_relevant.unshift({
    //     val:"coffee",
    //     upstream:false,
    //     downstream:false,
    //     confounding:false,
    //     mediating:false
    // })
    // let links_relevant=links.filter(link=>nodes_relevant.find(node=>node.val==link.source)&&nodes_relevant.find(node=>node.val==link.target));
    // links_relevant.push({
    //     source:'coffee',
    //     target:'cancer',
    //     type:'primary'
    // })


    links.push({
        source:'coffee',
        target:'cancer',
        type:'primary'
    })
    

    return {
        links:links,
        nodes:nodes_default,
        nodes_separated:nodes_separated
    }

    
}



function find_this(type, name) {
    return new Promise((resolve) => {
        switch (type) {
        case 'directory':
            fs.readdir(name, callback);
            break;
        case 'file':
            fs.readFile(name, 'utf8', callback);
            break;
        default:
        }

        function callback(err, data) {
        if (err) {
            resolve(undefined);
        }
        resolve(data);
        }
    });
}