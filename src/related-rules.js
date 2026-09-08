// Number matches are browsing aids, not verified legal relationships.
export function relatedRules(provision, district, catalog, relationships) {
  const related = [];
  for (const link of relationships.links) {
    if (link.status !== 'verified' || !link.editions.includes(provision.editionId)) continue;
    const id = link.from === provision.id ? link.to : link.to === provision.id ? link.from : null;
    const other = catalog.provisions.find(p => p.id === id);
    if (!other || !link.editions.includes(other.editionId) ||
        (other.districtId !== 'us' && other.districtId !== district)) continue;
    if (!related.some(item => item.p.id === other.id)) related.push({p: other, link});
  }
  if (provision.collectionId === 'federal-frcp' && district !== 'none') {
    for (const other of catalog.provisions) {
      if (other.districtId === district && other.collectionId === `${district}-civil` &&
          other.number === provision.number && other.status === 'active' &&
          !related.some(item => item.p.id === other.id)) related.push({p: other, link: null});
    }
  }
  return related;
}
