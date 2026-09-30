import React from "react";
import "../styles/hero.css";
import glazeBG from "../assets/glazeBG.png";
import missCuteBox from "../assets/missCuteBox.png";

function HeroSection() { 
  return (
    <section className="hero">
        <img src={glazeBG} alt="glaze drip" className="glazeBG-image" />
        <h1 className="hero-title">Glazy Days</h1>
        
        <div className="hero-content">
        <div className="promo">
          <h3 className="promo-highlight">SPECIAL HOLIDAY PROMO!</h3>
          <h2 className="promo-title">MISS CUTE BOX</h2>
          <p className="promo-text">
            Treat yourself to the deliciously soft and fluffy donuts with MISS CUTE BOX
            topped with rich glazes and irresistible flavors that will make every bite a delight. 
            Don’t miss this special promo sale—available exclusively at our local branches.
            Have a Glazy Day ahead! 
          </p>
        </div>

        <div className="hero-image">
          <img src={missCuteBox} alt="miss cute box" />
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
