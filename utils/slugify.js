const slugify = (notSlug) => notSlug.replace(/ /g, "-").toLowerCase();

export default slugify;
