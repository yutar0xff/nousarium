import { ServiceWorkerRegister } from "../components/sw-register";
import { HomeClient } from "../components/home-client";

export default function HomePage() {
  return (
    <>
      <ServiceWorkerRegister />
      <HomeClient />
    </>
  );
}
