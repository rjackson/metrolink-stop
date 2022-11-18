const slugify = (notSlug: string) => notSlug.replace(/ /g, "-").toLowerCase();

export default slugify;
