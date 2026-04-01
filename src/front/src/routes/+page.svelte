<script>
    
    
    
    const githubRepo = "https://github.com/gti-sos/SOS2526-26"; 

    
    const team = [
        {
            name: "Moises Guillermo Godoy Nava", 
            dataSource: "national-team-rankings-per-years", 
            frontend: "/front-mgn", 
            apis: [{url: "/api/v1/national-team-rankings-per-years", label: "v1"}], 
            postman: [{label: "Doc v1", url: "https://documenter.getpostman.com/view/53034281/2sBXigNZXJ"}]
        },
        {
            name: "Ricardo Fernandez Rodriguez-Navas",
            dataSource: "fifa-squad-value-per-years",
            frontend: "/front-rfr",
            apis: [{url: "/api/v2/fifa-squad-value-per-years", label: "v2"}],
            postman: [{label: "Doc v2", url: "https://documenter.getpostman.com/view/52260149/2sBXinGW4o"}]
        },
        {
            name: "Sergio Diaz Vazquez",
            dataSource: "countries-idh-per-years",
            frontend: "/front-sdv",
            apis: [{url: "/api/v2/countries-idh-per-years", label: "v2"}],
            postman: [{label: "Doc v2", url: "https://documenter.getpostman.com/view/52429610/2sBXinGqPs"}]
        } 
    ];
</script>

<main style="max-width: 800px; margin: 0 auto; padding: 20px; font-family: sans-serif;">
    <h1 style="text-align: center; color: #2c3e50;">Portal del Proyecto Grupo 26</h1>

    <section style="text-align: center; margin-bottom: 40px; margin-top: 20px;">
        <a href={githubRepo} target="_blank" style="background-color: #24292e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 1.1rem;">
            🔗 Repositorio de GitHub del Equipo
        </a>
    </section>

    <h2 style="border-bottom: 2px solid #3498db; padding-bottom: 10px;">Componentes del equipo y recursos</h2>
    
    <div style="display: flex; flex-direction: column; gap: 20px; margin-top: 20px;">
        {#each team as member}
            <div style="border: 1px solid #ddd; border-radius: 8px; padding: 20px; background-color: #f8f9fa; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                
                <h3 style="margin-top: 0; color: #2c3e50; font-size: 1.4rem;">🧑‍💻 {member.name}</h3>
                <p style="font-size: 1.1rem; color: #555;">
                    <strong>Fuente de datos API:</strong> <code style="background-color: #e9ecef; padding: 3px 6px; border-radius: 4px;">{member.dataSource}</code>
                </p>
                
                <div style="display: flex; flex-direction: column; gap: 15px; margin-top: 15px;">
                    <div>
                        <a href={member.frontend} style="display: inline-block; padding: 10px 15px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                            🖥️ Front-end Web
                        </a>
                    </div>

                    <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                        <span style="font-weight: bold; color: #666;">⚙️ APIs:</span>
                        {#each member.apis as api}
                            <a href={api.url} target="_blank" style="padding: 8px 12px; background-color: #2ecc71; color: white; text-decoration: none; border-radius: 5px; font-size: 0.9rem; font-weight: bold;">
                                {api.label}
                            </a>
                        {/each}
                    </div>

                    <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                        <span style="font-weight: bold; color: #666;">📄 Postman:</span>
                        {#each member.postman as doc}
                            <a href={doc.url} target="_blank" style="padding: 8px 12px; background-color: #ff6c37; color: white; text-decoration: none; border-radius: 5px; font-size: 0.9rem; font-weight: bold;">
                                {doc.label}
                            </a>
                        {/each}
                    </div>
                </div>
            </div>
        {/each}
    </div>
</main>