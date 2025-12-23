function makeId() {
  return (crypto && crypto.randomUUID) ? crypto.randomUUID() :
    ("id_" + Date.now() + "_" + Math.random().toString(16).slice(2));
}const photoId = makeId();


