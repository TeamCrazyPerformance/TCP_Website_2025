import React from "react";
import "../../styles/techArticlesReset.css";
import "../../styles/techArticlesPublic.css";
import "../../styles/techArticlesPublicAlign.css";

function TechArticlePublicContent({ children }) {
  return <div className="ta-public">{children}</div>;
}

export default TechArticlePublicContent;
