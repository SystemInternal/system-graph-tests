const fs   = require('fs');


let primary_nodes=["coffee","cancer"];



let input_links_location='data/worst_case_links-edited.json';
let output_data_location='data/processed-data.json';

generate();


async function generate(){
    let processed_data=await generate_from_source();
    
    console.log('Finished processing data. Groups found:',{
            loop:processed_data.link_groups.loop.length,
            confounding:processed_data.link_groups.confounding.length,
            mediating:processed_data.link_groups.mediating.length,
            p0_bidirectional:processed_data.link_groups.p0_bidirectional.length,
            p0_upstream:processed_data.link_groups.p0_upstream.length,
            p0_downstream:processed_data.link_groups.p0_downstream.length,
            p1_bidirectional:processed_data.link_groups.p1_bidirectional.length,
            p1_upstream:processed_data.link_groups.p1_upstream.length,
            p1_downstream:processed_data.link_groups.p1_downstream.length,
            primary:processed_data.link_groups.primary.length
        }
    )
    
    fs.writeFile(output_data_location, JSON.stringify(processed_data), err => {
        if (err) {
          console.error(err)
          return
        }
    })
    console.log('Wrote processed data to',output_data_location);

}



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




async function generate_from_source(){
    let links=await find_this('file',input_links_location)
    links=links?JSON.parse(links).links:undefined;
    let taglist=await find_this('file','data/taglist.json')
    taglist=JSON.parse(taglist).tags;
    console.log('Received data from',input_links_location);

    let nodes_categorized=generate_node_list(links);
    let link_groups=generate_grouped_links(nodes_categorized,links);

    console.log('Setting node group from link groupings');
    let nodes=nodes_categorized.map(a=>{
        let group=a.val==primary_nodes[0]?'p0':false;
        group=a.val==primary_nodes[1]?'p1':group;
        group=is_looping(a)&&!group?'feedback':group;
        group=is_confounding(a)&&!group?'confounder':group;
        group=is_mediating(a)&&!group?'mediator':group;
        group=(is_upstream_of(a,0)||is_bidirectional_with(a,0))&&!group?'upstream_p0':group;
        group=(is_downstream_of(a,1)||is_bidirectional_with(a,1))&&!group?'downstream_p1':group;
        group=is_downstream_of(a,0)&&!group?'downstream_p0':group;
        group=is_upstream_of(a,1)&&!group?'upstream_p1':group;
        
        return {
            val:a.val,
            primary:primary_nodes.includes(a.val),
            type:find_type(a.val),
            group:group
        };
    });

    // console.log(nodes);
    return {
        nodes,
        link_groups
    };

    function find_type(name){
        let type=undefined;
        
        for(let tag of taglist){
            type=tag.vals.includes(name)?tag.name:type;
        }
        return type;
    }
    
}

function generate_grouped_links(nodes,links){
    console.log('Looping through and grouping links');
    let link_groups={
        loop:[],
        confounding:[],
        mediating:[],
        p0_bidirectional:[],
        p0_upstream:[],
        p0_downstream:[],
        p1_bidirectional:[],
        p1_upstream:[],
        p1_downstream:[],
        primary:[{source:primary_nodes[0],target:primary_nodes[1],type:'primary'}]
    }

    
    for(let link of links){
        let source=nodes.find(a=>a.val==link.source);
        let target=nodes.find(a=>a.val==link.target);

        let primary;
        let not_primary;

        link.sign=Math.random()<=0.7?'positive':'negative';


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
                find_and_add(link_groups,"loop",not_primary.val,link)
            }else if(is_confounding(not_primary)){
                find_and_add(link_groups,"confounding",not_primary.val,link)
            }else if(is_mediating(source)){
                find_and_add(link_groups,"mediating",not_primary.val,link)
            }else if(is_mediating(target)){
                find_and_add(link_groups,"mediating",not_primary.val,link)
            }else if(is_bidirectional_with(not_primary,n)){
                find_and_add(link_groups,`p${n}_bidirectional`,not_primary.val,link)
            }else if(is_upstream_of(not_primary,n)){
                link_groups[`p${n}_upstream`].push(link);
            }else if(is_downstream_of(not_primary,n)){
                link_groups[`p${n}_downstream`].push(link);
            }else{
                console.log('[includes non-primary but not added:',link,']')
            }

        }else{
            console.log('[not added, does not include non-primary:',link,']')
        }

    }

    return link_groups;



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


function generate_node_list(links){
    let nodes=[];
    console.log('Making initial list of nodes and determining if they target p0 and/or p1');
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