export function Lighting() {
  return <>
    <ambientLight color="#e8f8f5" intensity={2} />
    <directionalLight position={[-10, 15, 20]} color="#ffffff" intensity={.25} />
  </>;
}
