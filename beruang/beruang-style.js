const tmpl = document.createElement('beruang-style');
tmpl.setAttribute('style', 'display: none;');
tmpl.innerHTML = `html{
--custom-font:arial;
--red-color:{color:red;};
--blue-color:{color:blue;font-family:--custom-font;};
--my-font:30px;
--font-12px:var(--my-font,20px);
--paragraph:{@apply --blue-color;};
}`;
document.head.appendChild(tmpl);