# Xiaoshi Zhou Academic Homepage

This is a lightweight static personal academic website for GitHub Pages.

The project is intentionally kept in its own folder:

```text
academic-homepage/
```

## Content Sources

- CAU faculty profile: <https://cem.cau.edu.cn/art/2023/9/28/art_34877_301.html>
- Local Zotero library search results for `Xiaoshi Zhou` and `周晓时`

The publication page does not display Zotero item keys. It uses the local Zotero
records only to check DOI and stable web links.

## Local Preview

```bash
cd academic-homepage
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Main Files

- `index.html`: homepage
- `about/index.html`: biography, contact, education and appointments
- `research/index.html`: research themes
- `publications/index.html`: selected publications
- `teaching/index.html`: courses and advising
- `resources/index.html`: replication and teaching resources
- `cv/index.html`: CV and external profile links
- `assets/css/site.css`: site design

## GitHub Pages Deployment

1. Create a GitHub repository named `<github-username>.github.io`.
2. Put the contents of `academic-homepage/` at the repository root.
3. Commit and push to the `main` branch.
4. In GitHub, open `Settings -> Pages`.
5. Set the source to `GitHub Actions`.
6. The workflow in `.github/workflows/pages.yml` will publish the static site.

To add a PDF CV later, put it at `assets/files/cv.pdf` and change the main
button in `cv/index.html` from the email link to `../assets/files/cv.pdf`.
