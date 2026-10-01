Personal website for shihaabalam.com, served by GitHub Pages.

- `index.html` is the homepage.
- `assets/site.css` and `assets/site.js` are shared by the homepage and post pages
  (styles, the glass nav, the smoke backgrounds and mouse stirring).
- `projects/` holds project case studies (`projects/celeste-rl.html`), linked from the homepage.
- `writing/` holds post pages. `writing/lorem-ipsum-dolor-sit-amet.html` is the
  unlinked example to copy for a new post.
- `404.html` is shown by GitHub Pages for any missing address, so its links start from the site root.
- Project images in `assets/` have a `.webp` copy that the homepage loads; the `.png`/`.jpg` originals are the
  fallback and the full-size links. Re-export the `.webp` when replacing an image.
- Visitor counts use GoatCounter (no cookies); the site code is set at the top of `assets/site.js`.
- `archive/editorial/` is the previous design, kept for reference and hidden from search engines.
