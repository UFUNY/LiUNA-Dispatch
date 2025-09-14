# LiUNA Dispatch

- A simple fornt end web application for managing employee dispatches. 
- Built with HTML, CSS, & JavaScript

## Features
- Consist of 2 main Pages(Employees & Dispatch)
* Employees page contains key components like name, address, and phone. 
but also consists of a Certifications tab and a Skill tab. This is key for LiUNA workers
* Also contains a classication to be able to track Apprentices (APP), Journeyman (JM), & Foremen (FM)
* There is a filter tab that auto updates when a new "cert" or "skill" is added to an employee. 
* Contains a staus indicator for every employee (active or inactive)
* It also includes a "cant work option" when you select the day someone can't work from the 7 day week, 
it will show on the employee card & wont list them when adding employees to a job
* Their card also shows if there working or not

* The dispatch page inlcudes a split screen view, in a 65/35 formation. The left side is the job site tracker & the 
right side is an interactive map using Google Maps API. 
* When adding a new "job" you add details including the name, address, general contractor info, skills needed, and     employees to add. 
* Also adding a new job will put a ping on the map where the job location is at. (green if active, and grey if inactive)
* When pressing on a job the map automatically detects the location and shows you the distance from your location to the job site. 
* It consists of 2 types, "active" or "inactive". They are both drop downs and can be turned on or off when pressing to edit. 
* when adding employees, it shows all active employees able to work for the selected day, but also shows employees that have already been selected on the same exact day. They will be shown towards the bottom and there card will be tinted grey, since they have been selected to work.
* If they are selected, they will be given a warning and will be removed from the other job site & added to the new one

### Styling
- The styling consists of plain neutral colors, but all buttons are outlined with their dark color. 
- Apprentices are colored Green, Journeyman are colored Blue, & Foreman are colored Orange.
- The employees "cards show important information and are stacked in 3 columns
