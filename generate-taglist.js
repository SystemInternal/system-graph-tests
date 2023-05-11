const fs   = require('fs');

compute_tags();

async function compute_tags(){
    let nodes=await find_this('file','data/categorized-nodes.json')
    nodes=JSON.parse(nodes);

    let taglist=[]

    // console.log(nodes);
    for(let node of nodes){
        if(node.type!=='other'&&node.type!==''){
            let tag=taglist.find(a=>a.name==node.type);
            if(tag!==undefined) tag.vals.push(node.name);
            else taglist.push({name:node.type,vals:[node.name]})
        }
        
    }

    // console.log(taglist);
    fs.writeFile('data/taglist.json', JSON.stringify(taglist), err => {
        if (err) {
          console.error(err)
          return
        }
    })
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