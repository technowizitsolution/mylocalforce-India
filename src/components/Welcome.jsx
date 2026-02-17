import Hero from "./Hero"
import Content from "./Content"
import Mid from "./Mid"
import Latest from "./Latest"
import Footer from "./Footer"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

const Welcome = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // If user is already authenticated
  if (isAuthenticated) {
    return navigate('/customer', { replace: true });
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