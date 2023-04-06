const fs   = require('fs');


let primary_nodes=["coffee","cancer"];


generate();

async function generate(){
    let source_data=await generate_from_source();
    console.log(source_data)

    fs.writeFile('data/dag-link-data.json', JSON.stringify(source_data), err => {
        if (err) {
          console.error(err)
          return
        }
    })

}


//props should be read as "has as",
//e.g. "p0_target" - > "this node has p0 as one of its targets"

//node checks:
const is_looping=(node)=>{
    return node.p0_target&&node.p1_source;
}
const is_confounding=(node)=>{
    return node.p0_target&&node.p1_target;
}
const is_mediating=(node)=>{
    return node.p0_source&&node.p1_target;
}
const is_upstream_of=(node,n)=>{
    return node[`p${n}_target`];
}
const is_downstream_of=(node,n)=>{
    return node[`p${n}_source`];
}

const is_bidirectional_with=(node,n)=>{
    return node[`p${n}_source`] && node[`p${n}_target`];
}



//return link and nodelist, one default and one filled in with real info
async function generate_from_source(){
    let links=await find_this('file','data/worst_case_links.json')
    links=links?JSON.parse(links).links:undefined;
    let nodes_categorized=generate_categorized_nodes(links);
    let links_categorized=generate_categorized_links(nodes_categorized,links);
    let nodes=nodes_categorized.map(a=>{
        return {val:a.val};
    });
    return {
        nodes,
        links_categorized
    };
    
}

function generate_categorized_links(nodes,links){
    let links_categorized={
        loop:[],
        confounding:[],
        mediating:[],
        p0_bidirectional:[],
        p0_upstream:[],
        p0_downstream:[],
        p1_bidirectional:[],
        p1_upstream:[],
        p1_downstream:[]
    }

    for(let link of links){
        let source=nodes.find(a=>a.val==link.source);
        let target=nodes.find(a=>a.val==link.target);

        let primary;
        let not_primary;

        if(primary_nodes.includes(source.val)){
            primary=source;
            if(!primary_nodes.includes(target.val)){
                not_primary=target;
            }
        }else if(primary_nodes.includes(target.val)){
            primary=target;
            if(!primary_nodes.includes(source.val)){
                not_primary=source;
            }
        }

        if(not_primary){
            let n=primary_nodes.indexOf(primary.val);
            if(is_looping(not_primary)){
                find_and_add(links_categorized,"loop",not_primary.val,link)
            }else if(is_confounding(not_primary)){
                find_and_add(links_categorized,"confounding",not_primary.val,link)
            }else if(is_mediating(source)){
                find_and_add(links_categorized,"mediating",not_primary.val,link)
            }else if(is_mediating(target)){
                find_and_add(links_categorized,"mediating",not_primary.val,link)
            }else if(is_bidirectional_with(not_primary,n)){
                find_and_add(links_categorized,`p${n}_bidirectional`,not_primary.val,link)
            }else if(is_upstream_of(not_primary,n)){
                links_categorized[`p${n}_upstream`].push(link);
            }else if(is_downstream_of(not_primary,n)){
                links_categorized[`p${n}_downstream`].push(link);
            }else{
                console.log('includes non-primary but not added:',link)
            }

        }else{
            console.log('not added, does not include non-primary:',link)
        }

    }
    // links_categorized={
    //     loop:links_categorized.loop.map(a=>a.links),
    //     confounding:links_categorized.confounding.map(a=>a.links),
    //     mediating:links_categorized.mediating.map(a=>a.links),
    //     p0_bidirectional:links_categorized.p0_bidirectional.map(a=>a.links),
    //     p0_upstream:links_categorized.p0_upstream,
    //     p0_downstream:links_categorized.p0_downstream,
    //     p1_bidirectional:links_categorized.p1_bidirectional.map(a=>a.links),
    //     p1_upstream:links_categorized.p1_upstream,
    //     p1_downstream:links_categorized.p1_downstream
    // }
    return links_categorized;



    function find_and_add(root,list,val,addition){
        let collection=root[list].find(a=>a.val==val)
        if(collection){
            collection.links.push(addition);
        }else{
            root[list].push({
                val:val,
                links:[
                    addition
                ]
            })
        }
    }
}


function generate_categorized_nodes(links){
    let nodes=[];
    for(let link of links){
        
        let source=nodes.find(a=>a.val==link.source)
        if (!source){
            nodes.push({
                val:link.source,
                p0_target:link.target==primary_nodes[0],
                p1_target:link.target==primary_nodes[1]
            });
        }else{
            if(!source.p0_target) source.p0_target=link.target==primary_nodes[0]
            if(!source.p1_target) source.p1_target=link.target==primary_nodes[1]
        }

        let target=nodes.find(a=>a.val==link.target);
        if (!target){
            nodes.push({
                val:link.target,
                p0_source:link.source==primary_nodes[0],
                p1_source:link.source==primary_nodes[1]
            });
        }else{
            if(!target.p0_source) target.p0_source=link.source==primary_nodes[0]
            if(!target.p1_source) target.p1_source=link.source==primary_nodes[1]
        }
    }

    return nodes;
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


// the goal is to end up with separate lists of links categorized by type, and grouped where applicable. Should be mutually exclusive
let example={
    //hierarchy of relevance — if something is a loop, it goes in there even if it's confounding or mediating. Then check for confounding, add even if also mediating. Then check for mediating. Add even if also upstream/downstream for the primaries. Then all the rest. 
    loop:[
        [
            {source:"",target:""},
            {source:"",target:""}
        ]
    ],
    confounding:[
        [
            {source:"",target:""},
            {source:"",target:""}
        ]
    ],
    mediating:[
        [
            {source:"",target:""},
            {source:"",target:""}
        ]
    ],
    //shared downstreams go in downstream
    //shared upstreams are confounding
    //bidirectionals affili
    upstream_1:[
        {source:"",target:""}
    ],
    downstream_1:[
        {source:"",target:""}
    ],
    upstream_2:[
        {source:"",target:""}
    ],
    downstream_2:[
        {source:"",target:""}
    ],
    bidirectional_1:[
        [
            {source:"",target:""},
            {source:"",target:""}
        ]
    ],
    bidirectional_2:[
        [
            {source:"",target:""},
            {source:"",target:""}
        ]
    ],
    
}