import Hero from "./Hero"
import Content from "./Content"
import Mid from "./Mid"
import Latest from "./Latest"
import Footer from "./Footer"
import { Navigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { Loading } from "./StateComponents"
import { getSignedInHomePath } from "../utils/providerFlow"

const Welcome = () => {
  const { isAuthenticated, user, userRoles, activeRole, isLoading } = useAuth();

  if (isLoading) {
    return <Loading fullScreen />;
  }

  if (isAuthenticated) {
    return (
      <Navigate
        to={getSignedInHomePath({
          user,
          roles: userRoles?.roles,
          activeRole,
        })}
        replace
      />
    );
  }

  return (
    <div>
        <Hero />
        <Content />
        <Mid />
        <Latest />
        <Footer />
    </div>
  )
}

export default Welcome
