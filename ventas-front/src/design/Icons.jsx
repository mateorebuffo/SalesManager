// src/design/Icons.jsx
// Small icon set — 24×24, stroke 1.75, currentColor. Tree-shakeable named exports.

const make = (path, opts = {}) => (props) => (
  <svg
    width={props.size || 22}
    height={props.size || 22}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={opts.sw || 1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={props.style}
    aria-hidden="true"
  >
    {path}
  </svg>
);

export const Home     = make(<><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9.5a.5.5 0 0 0 .5.5H9v-6h6v6h3.5a.5.5 0 0 0 .5-.5V10"/></>);
export const Cart     = make(<><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h2.5l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2"/></>);
export const Pkg      = make(<><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9M7.7 5.2l8.6 4.5"/></>);
export const Users    = make(<><circle cx="9" cy="9" r="3.5"/><path d="M2.5 20c.5-3.5 3.4-5.5 6.5-5.5s6 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M22 20c-.4-2.8-2.2-4.7-4.7-5.3"/></>);
export const Cash     = make(<><rect x="2.5" y="6.5" width="19" height="11" rx="1.5"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v4M18 10v4"/></>);
export const Plus     = make(<><path d="M12 5v14M5 12h14"/></>, { sw: 2 });
export const Minus    = make(<><path d="M5 12h14"/></>, { sw: 2 });
export const Search   = make(<><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.5-3.5"/></>);
export const ChevR    = make(<path d="m9 6 6 6-6 6"/>);
export const ChevL    = make(<path d="m15 6-6 6 6 6"/>);
export const ChevD    = make(<path d="m6 9 6 6 6-6"/>);
export const ChevU    = make(<path d="m6 15 6-6 6 6"/>);
export const X        = make(<path d="M6 6 18 18M18 6 6 18"/>);
export const Check    = make(<path d="m5 12 5 5L20 7"/>, { sw: 2.25 });
export const Bell     = make(<><path d="M6 17V11a6 6 0 1 1 12 0v6"/><path d="M4.5 17h15"/><path d="M10 20.5a2 2 0 0 0 4 0"/></>);
export const Filter   = make(<path d="M3 5h18l-7 9v6l-4-2v-4z"/>);
export const Edit     = make(<><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="m13.5 6 3 3"/></>);
export const Trash    = make(<><path d="M4 7h16M9 7V4.5h6V7"/><path d="M6 7v12.5A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V7"/><path d="M10 11v6M14 11v6"/></>);
export const Alert    = make(<><path d="M12 3 2.5 20h19z"/><path d="M12 10v5M12 18v.5"/></>);
export const Clock    = make(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>);
export const Calendar = make(<><rect x="3.5" y="5" width="17" height="15.5" rx="1.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></>);
export const ArrowUp  = make(<><path d="M12 19V5M5 12l7-7 7 7"/></>);
export const ArrowDown = make(<><path d="M12 5v14M19 12l-7 7-7-7"/></>);
export const Phone    = make(<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1A19.5 19.5 0 0 1 5.2 13a19.8 19.8 0 0 1-3.1-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6.4 6.4l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z"/>);
export const Receipt  = make(<><path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21z"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/></>);
export const Bolt     = make(<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>);
export const More     = make(<><circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/></>, { sw: 2 });
export const Sun      = make(<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4"/></>);
export const Moon     = make(<path d="M20.5 14.3A8 8 0 0 1 9.7 3.5a8 8 0 1 0 10.8 10.8z"/>);
export const Logout   = make(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></>);
export const Transfer = make(<><path d="M7 4v16M3 8l4-4 4 4"/><path d="M17 20V4M21 16l-4 4-4-4"/></>);
export const Crypto   = make(<><path d="M12 2.2 4 7v10l8 4.8 8-4.8V7z"/><path d="M9 9h4.5a2 2 0 0 1 0 4H9zm0 4h5a2 2 0 0 1 0 4H9zM11 7v2M11 17v2"/></>);
export const Truck    = make(<><rect x="1" y="7" width="14" height="12" rx="1"/><path d="M15 10V7.5h4.5L22 12v7h-7V10z"/><circle cx="6" cy="20.5" r="1.5"/><circle cx="17.5" cy="20.5" r="1.5"/></>);
