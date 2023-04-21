// import * as d3 from "d3.js";


let main = document.querySelector('main');
let graph_svg = document.querySelector('#graph');

let w = window.innerWidth;
let h = window.innerHeight;

let categories_visible = false;

let primary_nodes = {
  p0: true,
  p1: true
}
let primary_node_str = { p0: "coffee", p1: "cancer" };

let intermediary_str = ['loop', 'mediating', 'confounding'];


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
let nodes;


let graph;



setSize();
window.addEventListener('resize', setSize);

function setSize() {
  let sidebar = parseInt(getComputedStyle(document.body).getPropertyValue('--sidebar').replace('px', ''));
  w = window.innerWidth - sidebar + 20;
  h = window.innerHeight - 40;
  d3.select(graph_svg).attr('width', w + 'px');
  d3.select(graph_svg).attr('height', h + 'px');
  d3.select(graph_svg).attr('viewBox', `0 0 ${w} ${h}`);

}


fetch('data/dag-link-data.json')
  .then((response) => response.json())
  .then((data) => {
    nodes = data.nodes;
    link_lists = data.links_categorized;

    init(link_lists, nodes);
    graph_input = generate_graph_input();
    graph = new Graph(graph_input.nodes, graph_input.links, graph_svg);

  });

function init(link_lists, nodes) {
  let keys = Object.keys(link_lists);

  for (let key of keys) {
    let parts = key.split('_')
    map[key] = {
      count: link_lists[key].length
    };

    if (parts[0] !== 'primary') {
      map[key].field = parts.length > 1 ? document.querySelector(`#${parts[0]} div[data-name="${parts[1]}"]`) : document.querySelector(`div[data-name="${parts[0]}"]`)
      let range = map[key].field.querySelector('input');
      let counter = map[key].field.querySelector('.count');
      range.max = link_lists[key].length;
      range.value = link_lists[key].length;
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

    graph_input = generate_graph_input();
    graph.update(graph_input.nodes, graph_input.links);
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




const Graph = class {
  constructor(nodes, links, svg) {

    console.log(nodes,links,svg);
  }

  update(nodes, links) {
    // Make a shallow copy to protect against mutation, while
    // recycling old nodes to preserve position and velocity.

    const old_node = new Map(this.node.data().map(d => [d.val, d]));
    const old_link = new Map(this.link.data().map(d => [d.source.val + '-' + d.target.val, d]));

    nodes = nodes.map(d => Object.assign(old_node.get(d.val) || {}, d));
    links = links.map(d => Object.assign(old_link.get(d.source + '-' + d.target) || {}, d));

    console.log(nodes,links);


  }





}





